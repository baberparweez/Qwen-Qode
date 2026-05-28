import type { Tool, ToolResult } from "./types.js";
import { embed } from "../rag/embedder.js";
import { getStore } from "../rag/registry.js";

export const ragSearchTool: Tool = {
  definition: {
    type: "function",
    function: {
      name: "semantic_search",
      description:
        "Search the indexed project codebase using natural language. Returns semantically relevant code snippets and documentation, even if they don't share exact keywords with the query. Best for questions like 'how does authentication work', 'find the database connection logic', or 'where is error handling done'. Requires the project to be indexed first (use the Index button in the UI, or ask the user to index).",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Natural-language description of what you are looking for",
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
          "The semantic index is empty for this project. " +
          "Click the Index button (⊙) in the UI header to build it — it only takes a few seconds for most projects. " +
          "After indexing you can re-run this search.",
      };
    }

    try {
      const queryEmbedding = await embed(args.query);
      const results = store.search(queryEmbedding, args.top_k ?? 5);

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
    } catch (e: unknown) {
      return { success: false, output: `Semantic search failed: ${String(e)}` };
    }
  },
};
