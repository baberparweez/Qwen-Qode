import type { Tool, ToolResult } from "./types.js";

const TAVILY_API = "https://api.tavily.com/search";

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  answer?: string;
  results: TavilyResult[];
}

export const webSearchTool: Tool = {
  definition: {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for current information, documentation, API references, or recent news. Returns relevant results with titles, URLs, and content snippets. Use this when you need up-to-date information that may not be in the project codebase.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query",
          },
          max_results: {
            type: "number",
            description: "Number of results to return (default: 5, max: 10)",
          },
        },
        required: ["query"],
      },
    },
  },

  async execute(
    args: { query: string; max_results?: number },
    _cwd: string,
  ): Promise<ToolResult> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        output:
          "TAVILY_API_KEY is not set. Add it to your .env file to enable web search. " +
          "Get a free key at https://tavily.com (1,000 searches/month free).",
      };
    }

    const maxResults = Math.min(args.max_results ?? 5, 10);

    try {
      const resp = await fetch(TAVILY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: args.query,
          search_depth: "basic",
          max_results: maxResults,
          include_answer: true,
        }),
      });

      if (!resp.ok) {
        const err = await resp.text();
        return { success: false, output: `Tavily API error ${resp.status}: ${err}` };
      }

      const data = (await resp.json()) as TavilyResponse;
      const lines: string[] = [];

      if (data.answer) {
        lines.push(`Summary: ${data.answer}`, "");
      }

      for (const r of data.results) {
        lines.push(`Title: ${r.title}`);
        lines.push(`URL: ${r.url}`);
        lines.push(r.content.slice(0, 500).trim());
        lines.push("");
      }

      return { success: true, output: lines.join("\n").trim() };
    } catch (e: unknown) {
      return { success: false, output: `Web search failed: ${String(e)}` };
    }
  },
};
