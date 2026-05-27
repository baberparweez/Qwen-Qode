import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import type { Tool, ToolResult } from "./types.js";

export const writeFileTool: Tool = {
  definition: {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Write content to a file, creating it (and any parent directories) if it does not exist. Overwrites the file completely.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The file path to write (absolute or relative to project root)",
          },
          content: {
            type: "string",
            description: "The full content to write to the file",
          },
        },
        required: ["path", "content"],
      },
    },
  },

  async execute(args: { path: string; content: string }, cwd: string): Promise<ToolResult> {
    const absPath = resolve(cwd, args.path);
    try {
      mkdirSync(dirname(absPath), { recursive: true });
      writeFileSync(absPath, args.content, "utf-8");
      return { success: true, output: `Written: ${absPath}` };
    } catch (e: unknown) {
      return { success: false, output: String(e) };
    }
  },
};
