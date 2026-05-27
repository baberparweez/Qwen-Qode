import OpenAI from "openai";
import { API_KEY, BASE_URL, MODEL, MAX_TOKENS, MAX_ITERATIONS } from "./config.js";
import { toolDefinitions, executeTool } from "./tools/index.js";

// Build a plain-text description of available tools for the system prompt
function buildToolDocs(): string {
  return toolDefinitions
    .map((t) => {
      const fn = t.function;
      const params = fn.parameters as {
        properties?: Record<string, { type: string; description: string }>;
        required?: string[];
      };
      const args = Object.entries(params.properties ?? {})
        .map(([k, v]) => `  - ${k} (${v.type}${params.required?.includes(k) ? ", required" : ""}): ${v.description}`)
        .join("\n");
      return `### ${fn.name}\n${fn.description}\nArguments:\n${args}`;
    })
    .join("\n\n");
}

const SYSTEM_PROMPT = `You are Qwen Qode, an expert software engineering assistant powered by Qwen2.5-coder.
You help users understand, write, modify, and debug code in any programming language.

## Tools

You can call tools by emitting a JSON block wrapped in <tool_call> tags. You may call one tool at a time. After each tool result, decide if you need another tool or if you can answer.

Format:
<tool_call>
{"name": "tool_name", "args": {"key": "value"}}
</tool_call>

Available tools:

{TOOL_DOCS}

## Rules
- Always use list_files or read_file to inspect the project before making changes.
- When editing files, read them first, then use edit_file for targeted changes or write_file for full rewrites.
- Be concise. Show only changed lines, not entire unchanged files.
- Never guess file contents — read them first.
- Do not emit a <tool_call> and regular text in the same response. Either call a tool OR give your final answer.
- Current working directory: {CWD}`;

export type Message = OpenAI.Chat.ChatCompletionMessageParam;

export type AgentEvent =
  | { type: "text"; content: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; success: boolean; output: string }
  | { type: "error"; message: string }
  | { type: "done" };

export type EventHandler = (event: AgentEvent) => void;

const TOOL_NAMES = new Set(toolDefinitions.map((t) => t.function.name));
const TOOL_CALL_RE = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/;

function parseToolCall(text: string): { name: string; args: Record<string, unknown> } | null {
  // 1. Tagged format: <tool_call>{...}</tool_call>
  const tagged = TOOL_CALL_RE.exec(text);
  if (tagged) {
    try {
      const parsed = JSON.parse(tagged[1]);
      if (typeof parsed.name === "string" && TOOL_NAMES.has(parsed.name)) {
        return { name: parsed.name, args: parsed.args ?? {} };
      }
    } catch {}
  }

  // 2. Raw JSON anywhere in the response: {"name": "...", "args": {...}}
  const jsonMatch = /\{[\s\S]*"name"\s*:\s*"([^"]+)"[\s\S]*\}/.exec(text);
  if (jsonMatch) {
    // Find the outermost JSON object
    const start = text.indexOf("{");
    let depth = 0;
    let end = -1;
    for (let i = start; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end !== -1) {
      try {
        const parsed = JSON.parse(text.slice(start, end + 1));
        if (typeof parsed.name === "string" && TOOL_NAMES.has(parsed.name)) {
          return { name: parsed.name, args: parsed.args ?? {} };
        }
      } catch {}
    }
  }

  return null;
}

function stripToolCall(text: string): string {
  // Remove tagged blocks
  let out = text.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "");
  // Remove raw JSON tool call objects
  const jsonMatch = /\{[\s\S]*"name"\s*:\s*"([^"]+)"[\s\S]*\}/.exec(out);
  if (jsonMatch && TOOL_NAMES.has(jsonMatch[1])) {
    const start = out.indexOf("{");
    let depth = 0;
    let end = -1;
    for (let i = start; i < out.length; i++) {
      if (out[i] === "{") depth++;
      else if (out[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end !== -1) out = (out.slice(0, start) + out.slice(end + 1));
  }
  return out.trim();
}

export class Agent {
  private client: OpenAI;
  private messages: Message[] = [];
  private cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
    this.client = new OpenAI({
      apiKey: API_KEY,
      baseURL: BASE_URL,
      defaultHeaders: {
        "HTTP-Referer": "https://github.com/qwen-qode",
        "X-Title": "Qwen Qode",
      },
    });
    this.messages.push({ role: "system", content: this.buildSystemPrompt(cwd) });
  }

  private buildSystemPrompt(cwd: string): string {
    return SYSTEM_PROMPT
      .replace("{TOOL_DOCS}", buildToolDocs())
      .replace("{CWD}", cwd);
  }

  setCwd(cwd: string) {
    this.cwd = cwd;
    process.chdir(cwd);
    this.messages[0] = { role: "system", content: this.buildSystemPrompt(cwd) };
  }

  getCwd(): string {
    return this.cwd;
  }

  async run(userMessage: string, onEvent: EventHandler): Promise<void> {
    this.messages.push({ role: "user", content: userMessage });

    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      let response: OpenAI.Chat.ChatCompletion;
      try {
        response = await this.client.chat.completions.create({
          model: MODEL,
          messages: this.messages,
          max_tokens: MAX_TOKENS,
          temperature: 0.1,
        });
      } catch (e: unknown) {
        onEvent({ type: "error", message: `API error: ${String(e)}` });
        return;
      }

      const choice = response.choices[0];
      if (!choice) {
        onEvent({ type: "error", message: "No response from model" });
        return;
      }

      const rawText = choice.message.content ?? "";
      const toolCall = parseToolCall(rawText);

      if (!toolCall) {
        // No tool call — this is the final answer
        const prose = stripToolCall(rawText);
        if (prose) onEvent({ type: "text", content: prose });
        this.messages.push({ role: "assistant", content: rawText });
        break;
      }

      // Has a tool call — emit it, run it, inject result
      const prose = stripToolCall(rawText);
      if (prose) onEvent({ type: "text", content: prose });

      onEvent({ type: "tool_call", name: toolCall.name, args: toolCall.args });
      const result = await executeTool(toolCall.name, toolCall.args, this.cwd);
      onEvent({ type: "tool_result", name: toolCall.name, success: result.success, output: result.output });

      // Store assistant turn (with the tool_call tag) then inject result as a user message
      this.messages.push({ role: "assistant", content: rawText });
      this.messages.push({
        role: "user",
        content: `<tool_result name="${toolCall.name}" success="${result.success}">\n${result.output}\n</tool_result>`,
      });
    }

    if (iterations >= MAX_ITERATIONS) {
      onEvent({ type: "error", message: `Reached max iterations (${MAX_ITERATIONS})` });
    }

    onEvent({ type: "done" });
  }

  getMessages(): Message[] {
    return this.messages;
  }

  clearHistory() {
    this.messages = [this.messages[0]];
  }
}
