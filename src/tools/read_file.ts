import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import type { Tool, ToolResult } from "./types.js";

export const readFileTool: Tool = {
  definition: {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read the contents of a file at a given path. Returns the file content with line numbers prefixed.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The file path to read (absolute or relative to project root)",
          },
          start_line: {
            type: "number",
            description: "Optional: 1-based line number to start reading from",
          },
          end_line: {
            type: "number",
            description: "Optional: 1-based line number to stop reading at (inclusive)",
          },
        },
        required: ["path"],
      },
    },
  },

  async execute(args: { path: string; start_line?: number; end_line?: number }, cwd: string): Promise<ToolResult> {
    const absPath = resolve(cwd, args.path);
    if (!existsSync(absPath)) {
      return { success: false, output: `File not found: ${absPath}` };
    }
    try {
      const content = readFileSync(absPath, "utf-8");
      const lines = content.split("\n");
      const start = args.start_line ? args.start_line - 1 : 0;
      const end = args.end_line ? args.end_line : lines.length;
      const slice = lines.slice(start, end);
      const numbered = slice
        .map((line, i) => `${String(start + i + 1).padStart(4, " ")} | ${line}`)
        .join("\n");
      return { success: true, output: numbered };
    } catch (e: unknown) {
      return { success: false, output: String(e) };
    }
  },
};
