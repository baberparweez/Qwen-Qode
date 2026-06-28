import { describe, it } from "node:test";
import { expect } from "./expect.js";
import { parseToolCall, stripToolCall, safeStreamEnd, Agent } from "../agent.js";

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
