import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import type { Tool, ToolResult } from "./types.js";

export const editFileTool: Tool = {
  definition: {
    type: "function",
    function: {
      name: "edit_file",
      description:
        "Replace an exact string in a file with new content. The old_string must appear exactly once in the file. Use read_file first to see the current content.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The file path to edit (absolute or relative to project root)",
          },
          old_string: {
            type: "string",
            description: "The exact text to find and replace. Must be unique in the file.",
          },
          new_string: {
            type: "string",
            description: "The text to replace old_string with",
          },
        },
        required: ["path", "old_string", "new_string"],
      },
    },
  },

  async execute(args: { path: string; old_string: string; new_string: string }, cwd: string): Promise<ToolResult> {
    const absPath = resolve(cwd, args.path);
    if (!existsSync(absPath)) {
      return { success: false, output: `File not found: ${absPath}` };
    }
    try {
      const content = readFileSync(absPath, "utf-8");
      const count = content.split(args.old_string).length - 1;
      if (count === 0) {
        return { success: false, output: `old_string not found in file. Read the file first to confirm exact content.` };
      }
      if (count > 1) {
        return { success: false, output: `old_string appears ${count} times — provide more context to make it unique.` };
      }
      writeFileSync(absPath, content.replace(args.old_string, args.new_string), "utf-8");
      return { success: true, output: `Edited: ${absPath}` };
    } catch (e: unknown) {
      return { success: false, output: String(e) };
    }
  },
};
