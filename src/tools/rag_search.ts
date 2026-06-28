import type { Tool, ToolResult } from "./types.js";
import { getStore } from "../rag/registry.js";

export const ragSearchTool: Tool = {
  definition: {
    type: "function",
    function: {
      name: "semantic_search",
      description:
        "Search the indexed project codebase using natural language or keywords. " +
        "Uses BM25 ranking — great for finding code by function name, pattern, or concept. " +
        "Examples: 'authentication middleware', 'database connection', 'error handling'. " +
        "Requires the project to be indexed first (click the ⊙ Index button in the UI header).",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Keywords or natural-language description of what you are looking for",
          },
          top_k: {
            type: "number",
            description: "Number of results to return (default: 5)",
          },
        },
        required: ["query"],
      },
    },
  },

  async execute(
    args: { query: string; top_k?: number },
    cwd: string,
  ): Promise<ToolResult> {
    const store = getStore(cwd);

    if (store.size() === 0) {
      return {
        success: false,
        output:
          "The search index is empty for this project. " +
          "Click the ⊙ Index button in the UI header to build it — takes a few seconds. " +
          "After indexing you can re-run this search.",
      };
    }

    const results = store.search(args.query, args.top_k ?? 5);

    if (results.length === 0) {
      return { success: true, output: "No relevant results found." };
    }

    const lines: string[] = [`Found ${results.length} relevant snippets:\n`];
    for (const { chunk, score } of results) {
      lines.push(`--- ${chunk.file} (score: ${score.toFixed(3)}) ---`);
      lines.push(chunk.text);
      lines.push("");
    }

    return { success: true, output: lines.join("\n").trim() };
  },
};
