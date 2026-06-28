import OpenAI from "openai";
import { API_KEY, BASE_URL, MODEL, MODELS, MAX_TOKENS, MAX_ITERATIONS } from "./config.js";

const isLocal = BASE_URL.includes("localhost") || BASE_URL.includes("127.0.0.1");
import { toolDefinitions, executeTool } from "./tools/index.js";

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

/** Friendly display name for a model id (falls back to the raw id). */
function modelLabel(id: string): string {
  return MODELS.find((m) => m.id === id)?.name ?? id;
}

const SYSTEM_PROMPT = `You are Qwen Qode, an expert software engineering assistant. You are running on the {MODEL} model.
You help users understand, write, modify, and debug code in any programming language.
If asked which model powers you, answer {MODEL}.

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

/** Turn an OpenAI SDK error into a clear, actionable message. */
export function formatApiError(e: unknown): string {
  const err = e as {
    status?: number;
    code?: string;
    error?: { message?: string };
    message?: string;
  };
  const status = err.status;
  const detail = err.error?.message || err.message || String(e);

  if (status === 401 || status === 403) {
    return `Authentication failed (${status}). Check OPENROUTER_API_KEY in your .env.`;
  }
  if (status === 402) {
    return `Insufficient credits (402). Top up your OpenRouter account or switch to a free/local model.`;
  }
  if (status === 429) {
    return `Rate limited (429): ${detail}. Wait a few seconds and try again.`;
  }
  if (status && status >= 500) {
    return `Model provider error (${status}): ${detail}. This is usually a temporary upstream issue — please try again.`;
  }
  if (err.code === "ECONNREFUSED" || /ECONNREFUSED/.test(detail)) {
    return `Could not connect to ${BASE_URL}. Is your local model server (Ollama/LM Studio) running?`;
  }
  // Statusless transient failures — usually a mid-stream drop from the provider.
  if (/internal server error|econnreset|socket hang up|terminated|premature close|aborted|fetch failed/i.test(detail)) {
    return `The model provider dropped the connection (${detail}). This is usually temporary — please send your message again.`;
  }
  if (status) {
    return `API error (${status}): ${detail}`;
  }
  return `API error: ${detail}`;
}

const TAG_OPEN = "<tool_call>";
const RAW_PREFIX = '{"name":';

/**
 * Largest index up to which `text` (starting at `from`) can be safely streamed
 * as prose — i.e. it cannot be part of a tool-call marker. Holds back at the
 * first `{` that could begin a raw JSON tool call (`{"name": …`) or the first
 * `<` that could begin a `<tool_call>` tag, including partial markers that are
 * still arriving across stream chunks. Plain `{`/`<` in prose or code pass
 * through after one chunk of look-ahead.
 */
export function safeStreamEnd(text: string, from: number): number {
  for (let pos = from; pos < text.length; pos++) {
    const ch = text[pos];
    if (ch === "<") {
      const sub = text.slice(pos, pos + TAG_OPEN.length);
      if (sub === TAG_OPEN) return pos;          // confirmed tag
      if (TAG_OPEN.startsWith(sub)) return pos;  // partial tag at buffer end — hold
    } else if (ch === "{") {
      // Compare a small whitespace-stripped window against `{"name":`.
      const compact = text.slice(pos, pos + 32).replace(/\s+/g, "");
      if (/^\{"name":/.test(compact)) return pos;       // confirmed raw tool call
      if (RAW_PREFIX.startsWith(compact)) return pos;    // partial — hold
    }
  }
  return text.length;
}

const TOOL_NAMES = new Set(toolDefinitions.map((t) => t.function.name));
const TOOL_CALL_RE = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/;

export function parseToolCall(text: string): { name: string; args: Record<string, unknown> } | null {
  const tagged = TOOL_CALL_RE.exec(text);
  if (tagged) {
    try {
      const parsed = JSON.parse(tagged[1]);
      if (typeof parsed.name === "string" && TOOL_NAMES.has(parsed.name)) {
        return { name: parsed.name, args: parsed.args ?? {} };
      }
    } catch {}
  }

  const jsonMatch = /\{[\s\S]*"name"\s*:\s*"([^"]+)"[\s\S]*\}/.exec(text);
  if (jsonMatch) {
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

export function stripToolCall(text: string): string {
  let out = text.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "");
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
  private model: string;

  constructor(cwd: string, model?: string) {
    this.cwd = cwd;
    this.model = model ?? MODEL;
    this.client = new OpenAI({
      apiKey: API_KEY || "local",
      baseURL: BASE_URL,
      maxRetries: 4,        // retry transient 408/409/429/5xx (default is 2)
      timeout: 120_000,     // 2 min — long codegen responses can be slow
      defaultHeaders: isLocal ? {} : {
        "HTTP-Referer": "https://github.com/baberparweez/qwen-qode",
        "X-Title": "Qwen Qode",
      },
    });
    this.messages.push({ role: "system", content: this.buildSystemPrompt(cwd) });
  }

  private buildSystemPrompt(cwd: string): string {
    return SYSTEM_PROMPT
      .replace("{TOOL_DOCS}", buildToolDocs())
      .replace(/\{MODEL\}/g, modelLabel(this.model))
      .replace("{CWD}", cwd);
  }

  setCwd(cwd: string) {
    this.cwd = cwd;
    process.chdir(cwd);
    this.messages[0] = { role: "system", content: this.buildSystemPrompt(cwd) };
  }

  setModel(model: string) {
    this.model = model;
    // Rebuild the system prompt so "running on {MODEL}" reflects the new model.
    this.messages[0] = { role: "system", content: this.buildSystemPrompt(this.cwd) };
  }

  getModel(): string {
    return this.model;
  }

  getCwd(): string {
    return this.cwd;
  }

  // images: array of data URLs e.g. "data:image/png;base64,..."
  async run(userMessage: string, onEvent: EventHandler, images?: string[]): Promise<void> {
    if (images && images.length > 0) {
      this.messages.push({
        role: "user",
        content: [
          { type: "text", text: userMessage },
          ...images.map((url) => ({
            type: "image_url" as const,
            image_url: { url },
          })),
        ],
      });
    } else {
      this.messages.push({ role: "user", content: userMessage });
    }

    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      let rawText = "";
      let emittedUpTo = 0;   // index in rawText up to which we've emitted text events

      // Stream the model response. Retry the request only while no text has been
      // shown to the user yet (a clean connection-time failure) — retrying after
      // partial output would duplicate text in the UI.
      const MAX_ATTEMPTS = 3;
      let streamed = false;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS && !streamed; attempt++) {
        rawText = "";
        emittedUpTo = 0;
        try {
          const stream = await this.client.chat.completions.create({
            model: this.model,
            messages: this.messages,
            max_tokens: MAX_TOKENS,
            temperature: 0.1,
            stream: true,
          });

          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content ?? "";
            if (!delta) continue;
            rawText += delta;

            // Emit prose up to the next possible tool-call marker (raw JSON or tag).
            const safeEnd = safeStreamEnd(rawText, emittedUpTo);
            if (safeEnd > emittedUpTo) {
              onEvent({ type: "text", content: rawText.slice(emittedUpTo, safeEnd) });
              emittedUpTo = safeEnd;
            }
          }
          streamed = true;
        } catch (e: unknown) {
          // Safe to retry only if nothing was shown to the user this attempt.
          if (emittedUpTo === 0 && attempt < MAX_ATTEMPTS) {
            await new Promise((r) => setTimeout(r, 500 * attempt));
            continue;
          }
          onEvent({ type: "error", message: formatApiError(e) });
          return;
        }
      }

      const toolCall = parseToolCall(rawText);

      if (!toolCall) {
        // No tool call — emit whatever text wasn't streamed yet (e.g. trailing whitespace)
        const remaining = rawText.slice(emittedUpTo).trim();
        if (remaining) onEvent({ type: "text", content: remaining });
        this.messages.push({ role: "assistant", content: rawText });
        break;
      }

      // Tool call found. Any prose before it was already streamed token-by-token.
      // If nothing was emitted yet (edge case), emit the stripped prose now.
      const prose = stripToolCall(rawText);
      if (prose && emittedUpTo === 0) onEvent({ type: "text", content: prose });

      onEvent({ type: "tool_call", name: toolCall.name, args: toolCall.args });
      const result = await executeTool(toolCall.name, toolCall.args, this.cwd);
      onEvent({ type: "tool_result", name: toolCall.name, success: result.success, output: result.output });

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
