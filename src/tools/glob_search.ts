import { execSync } from "child_process";
import { resolve } from "path";
import type { Tool, ToolResult } from "./types.js";

export const globSearchTool: Tool = {
  definition: {
    type: "function",
    function: {
      name: "glob_search",
      description: "Search for files matching a glob pattern, or grep for a string/regex across files.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Glob pattern to match files (e.g. '**/*.ts') OR a grep regex" },
          search_type: { type: "string", enum: ["glob", "grep"], description: "Use 'glob' for file patterns, 'grep' to search file contents" },
          path: { type: "string", description: "Root directory to search in (default: project root)" },
          file_pattern: { type: "string", description: "For grep: restrict to files matching this glob (e.g. '*.ts')" },
        },
        required: ["pattern", "search_type"],
      },
    },
  },

  async execute(args: { pattern: string; search_type: "glob" | "grep"; path?: string; file_pattern?: string }, cwd: string): Promise<ToolResult> {
    const dir = resolve(cwd, args.path ?? ".");
    try {
      let cmd: string;
      if (args.search_type === "glob") {
        cmd = `find "${dir}" -path "*/node_modules" -prune -o -path "*/.git" -prune -o -name "${args.pattern}" -print 2>/dev/null | head -100`;
      } else {
        const include = args.file_pattern ? `--include="${args.file_pattern}"` : "";
        cmd = `grep -r --line-number ${include} -E "${args.pattern.replace(/"/g, '\\"')}" "${dir}" --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null | head -100`;
      }
      const output = execSync(cmd, { encoding: "utf-8", timeout: 15_000 });
      return { success: true, output: output || "(no matches)" };
    } catch (e: unknown) {
      const err = e as { stdout?: string };
      return { success: true, output: err.stdout || "(no matches)" };
    }
  },
};
