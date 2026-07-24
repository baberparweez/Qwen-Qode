import { describe, it } from "node:test";
import { expect } from "./expect.js";
import { parseToolCall, stripToolCall, safeStreamEnd, looksLikeToolAttempt, Agent, type AgentEvent } from "../agent.js";

/** Replace an Agent's OpenAI client with a mock that streams canned responses. */
function withMock(agent: Agent, responses: Array<{ content: string; finish_reason?: string }>) {
  let i = 0;
  const client = {
    chat: {
      completions: {
        create: async () => {
          const r = responses[Math.min(i, responses.length - 1)];
          i++;
          async function* gen() {
            const parts = r.content.match(/[\s\S]{1,8}/g) ?? [""];
            for (const p of parts) yield { choices: [{ delta: { content: p }, finish_reason: null }] };
            yield { choices: [{ delta: {}, finish_reason: r.finish_reason ?? "stop" }] };
          }
          return gen();
        },
      },
    },
  };
  (agent as unknown as { client: typeof client }).client = client;
}

function collectText(events: AgentEvent[]): string {
  return events.flatMap((e) => (e.type === "text" ? [e.content] : [])).join("");
}

describe("parseToolCall", () => {
  describe("tagged format <tool_call>...</tool_call>", () => {
    it("parses a tagged tool call", () => {
      const text = `<tool_call>\n{"name": "list_files", "args": {"path": "."}}\n</tool_call>`;
      const result = parseToolCall(text);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("list_files");
      expect(result!.args).toEqual({ path: "." });
    });

    it("handles missing args field gracefully", () => {
      const text = `<tool_call>{"name": "list_files"}</tool_call>`;
      const result = parseToolCall(text);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("list_files");
      expect(result!.args).toEqual({});
    });

    it("returns null for an unknown tool name in a tag", () => {
      const text = `<tool_call>{"name": "explode_computer", "args": {}}</tool_call>`;
      expect(parseToolCall(text)).toBeNull();
    });

    it("returns null for invalid JSON inside tags", () => {
      const text = `<tool_call>not json at all</tool_call>`;
      expect(parseToolCall(text)).toBeNull();
    });
  });

  describe("raw JSON format", () => {
    it("parses a raw JSON tool call with no tags", () => {
      const text = `{"name": "read_file", "args": {"path": "src/index.ts"}}`;
      const result = parseToolCall(text);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("read_file");
      expect(result!.args).toEqual({ path: "src/index.ts" });
    });

    it("parses a raw JSON tool call embedded in prose", () => {
      const text = `I'll read the file now.\n{"name": "read_file", "args": {"path": "index.ts"}}\nLet me check.`;
      const result = parseToolCall(text);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("read_file");
    });

    it("returns null for raw JSON with an unknown tool name", () => {
      const text = `{"name": "unknown_tool", "args": {}}`;
      expect(parseToolCall(text)).toBeNull();
    });

    it("returns null for a plain object with no name field", () => {
      const text = `{"key": "value"}`;
      expect(parseToolCall(text)).toBeNull();
    });
  });

  describe("all tool names are recognised", () => {
    const tools = ["read_file", "write_file", "edit_file", "list_files", "bash", "glob_search", "git", "web_search", "semantic_search"];
    for (const name of tools) {
      it(`recognises ${name}`, () => {
        const text = `{"name": "${name}", "args": {}}`;
        const result = parseToolCall(text);
        expect(result).not.toBeNull();
        expect(result!.name).toBe(name);
      });
    }
  });
});

describe("stripToolCall", () => {
  it("removes a tagged tool call block, leaving surrounding prose", () => {
    const text = `Here is the plan.\n<tool_call>{"name": "list_files", "args": {}}</tool_call>\nDone.`;
    const stripped = stripToolCall(text);
    expect(stripped).toContain("Here is the plan.");
    expect(stripped).toContain("Done.");
    expect(stripped).not.toContain("<tool_call>");
    expect(stripped).not.toContain("list_files");
  });

  it("removes a raw JSON tool call, leaving surrounding prose", () => {
    const text = `Let me check.\n{"name": "read_file", "args": {"path": "x.ts"}}\nFound it.`;
    const stripped = stripToolCall(text);
    expect(stripped).not.toContain('"name"');
    expect(stripped).toContain("Let me check.");
    expect(stripped).toContain("Found it.");
  });

  it("returns the text unchanged when there is no tool call", () => {
    const text = "Just a plain response with no tool calls.";
    expect(stripToolCall(text)).toBe(text);
  });

  it("trims leading and trailing whitespace from the result", () => {
    const text = `<tool_call>{"name": "bash", "args": {"command": "ls"}}</tool_call>`;
    expect(stripToolCall(text)).toBe("");
  });
});

describe("safeStreamEnd", () => {
  it("emits all of plain prose with no markers", () => {
    const text = "Here is a plain explanation with no tool calls.";
    expect(safeStreamEnd(text, 0)).toBe(text.length);
  });

  it("stops at a raw JSON tool call that follows prose (the leak bug)", () => {
    const text = `Sure, let's list the files.\n\n{"name": "list_files", "args": {"path": "."}}`;
    expect(safeStreamEnd(text, 0)).toBe(text.indexOf("{"));
  });

  it("stops at index 0 when the response is only a raw tool call", () => {
    const text = `{"name": "read_file", "args": {"path": "a.ts"}}`;
    expect(safeStreamEnd(text, 0)).toBe(0);
  });

  it("stops at a <tool_call> tag that follows prose", () => {
    const text = `Let me read it.\n<tool_call>{"name": "read_file"}</tool_call>`;
    expect(safeStreamEnd(text, 0)).toBe(text.indexOf("<"));
  });

  it("handles whitespace between { and \"name\"", () => {
    const text = `Doing it now {  "name": "bash", "args": {}}`;
    expect(safeStreamEnd(text, 0)).toBe(text.indexOf("{"));
  });

  it("holds back a partial raw prefix arriving at the buffer end", () => {
    const text = `working on it {"na`;
    expect(safeStreamEnd(text, 0)).toBe(text.indexOf("{"));
  });

  it("holds back a partial tag arriving at the buffer end", () => {
    const text = `one moment <tool`;
    expect(safeStreamEnd(text, 0)).toBe(text.indexOf("<"));
  });

  it("does not hold back a plain brace in prose or code", () => {
    const text = `the object { foo: 1 } is fine`;
    expect(safeStreamEnd(text, 0)).toBe(text.length);
  });

  it("does not hold back a less-than used as comparison", () => {
    const text = `if a < b then return`;
    expect(safeStreamEnd(text, 0)).toBe(text.length);
  });
});

describe("Agent system prompt", () => {
  it("names the active model (friendly name)", () => {
    const a = new Agent("/tmp", "z-ai/glm-5.2");
    expect(a.getMessages()[0].content as string).toContain("GLM-5.2");
  });

  it("does not hardcode Qwen2.5-coder for a non-Qwen model", () => {
    const a = new Agent("/tmp", "z-ai/glm-5.2");
    expect(a.getMessages()[0].content as string).not.toContain("Qwen2.5-coder");
  });

  it("updates the model name in the prompt when switched", () => {
    const a = new Agent("/tmp", "qwen/qwen-2.5-coder-32b-instruct");
    a.setModel("z-ai/glm-5.2");
    expect(a.getMessages()[0].content as string).toContain("GLM-5.2");
  });

  it("falls back to the raw id for an unknown model", () => {
    const a = new Agent("/tmp", "some/custom-model");
    expect(a.getMessages()[0].content as string).toContain("some/custom-model");
  });
});

describe("looksLikeToolAttempt", () => {
  it("detects a tool call truncated mid-JSON", () => {
    const text = `<tool_call>\n{"name": "edit_file", "args": {"path": "src/ui.ts", "old_string": "import chalk`;
    expect(looksLikeToolAttempt(text)).toBe(true);
  });

  it("detects a truncated tag before the name value closes", () => {
    expect(looksLikeToolAttempt(`<tool_call>{"name": "edit_fi`)).toBe(true);
  });

  it("detects a valid full tool call", () => {
    expect(looksLikeToolAttempt(`<tool_call>{"name": "list_files", "args": {}}</tool_call>`)).toBe(true);
  });

  it("does NOT flag a final answer that merely discusses tools", () => {
    const text = "parseToolCall uses a regex; the edit_file tool should back up files, and write_file overwrites.";
    expect(looksLikeToolAttempt(text)).toBe(false);
  });

  it("does NOT flag JSON whose name is not a known tool", () => {
    expect(looksLikeToolAttempt(`{"name": "John Smith", "role": "admin"}`)).toBe(false);
  });

  it("does NOT flag prose that mentions the <tool_call> tag conceptually", () => {
    expect(looksLikeToolAttempt("The model emits a <tool_call> block to call a tool.")).toBe(false);
  });
});

describe("Agent.run robustness", () => {
  it("does not emit a max-iterations error when a final answer is produced", async () => {
    const agent = new Agent("/tmp", "qwen/qwen3-coder-30b-a3b-instruct");
    withMock(agent, [{ content: "Here is your answer. All done." }]);
    const events: AgentEvent[] = [];
    await agent.run("hi", (e) => events.push(e));
    expect(events.filter((e) => e.type === "error").length).toBe(0);
    expect(collectText(events)).toContain("Here is your answer");
  });

  it("never shows a truncated tool call as text — it retries instead", async () => {
    const agent = new Agent("/tmp", "qwen/qwen3-coder-30b-a3b-instruct");
    withMock(agent, [
      { content: `<tool_call>\n{"name": "edit_file", "args": {"path": "a.ts", "old_string": "aaaa`, finish_reason: "length" },
      { content: "OK, I made a smaller change instead." },
    ]);
    const events: AgentEvent[] = [];
    await agent.run("edit the file", (e) => events.push(e));
    const text = collectText(events);
    expect(text).not.toContain("<tool_call>");
    expect(text).not.toContain("edit_file");
    expect(text).toContain("smaller change");
    expect(events.filter((e) => e.type === "error").length).toBe(0);
  });

  it("reports a clean error after repeated invalid tool calls, not raw JSON", async () => {
    const agent = new Agent("/tmp", "qwen/qwen3-coder-30b-a3b-instruct");
    withMock(agent, [{ content: `<tool_call>{"name": "bash", "args": {"command": "ls` }]); // always invalid
    const events: AgentEvent[] = [];
    await agent.run("run ls", (e) => events.push(e));
    expect(collectText(events)).not.toContain("<tool_call>");
    const errors = events.filter((e) => e.type === "error");
    expect(errors.length).toBe(1);
  });
});

describe("Agent context bounding", () => {
  it("drops oldest non-system messages but keeps the system prompt and recent ones", () => {
    const agent = new Agent("/tmp", "qwen/qwen3-coder-30b-a3b-instruct");
    const internal = agent as unknown as {
      messages: Array<{ role: string; content: string }>;
      pruneHistory(): void;
    };
    const big = "x".repeat(50_000);
    for (let i = 0; i < 20; i++) {
      internal.messages.push({ role: i % 2 ? "assistant" : "user", content: big });
    }
    const before = internal.messages.length;
    internal.pruneHistory();
    expect(internal.messages.length < before).toBe(true);
    expect(internal.messages[0].role).toBe("system"); // system prompt never dropped
    expect(internal.messages.length >= 5).toBe(true);  // keeps system + recent
  });
});
