import { execFileSync } from "child_process";
import { resolve } from "path";
import { glob } from "glob";
import type { Tool, ToolResult } from "./types.js";

const MAX_RESULTS = 100;
const MAX_OUTPUT = 10_000;

function limitOutput(text: string): string {
  const lines = text.split("\n").slice(0, MAX_RESULTS).join("\n");
  return lines.length > MAX_OUTPUT ? lines.slice(0, MAX_OUTPUT) + "\n… (truncated)" : lines;
}

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

  async execute(
    args: { pattern: string; search_type: "glob" | "grep"; path?: string; file_pattern?: string },
    cwd: string,
  ): Promise<ToolResult> {
    const dir = resolve(cwd, args.path ?? ".");

    // ── glob: use the glob package directly — no shell, so nothing to inject. ──
    if (args.search_type === "glob") {
      try {
        // A bare pattern with no separator matches recursively by basename.
        const pattern = args.pattern.includes("/") ? args.pattern : `**/${args.pattern}`;
        const matches = await glob(pattern, {
          cwd: dir,
          ignore: ["**/node_modules/**", "**/.git/**"],
          nodir: true,
          dot: false,
        });
        const out = matches.slice(0, MAX_RESULTS).join("\n");
        return { success: true, output: out || "(no matches)" };
      } catch (e: unknown) {
        return { success: false, output: `glob failed: ${String(e)}` };
      }
    }

    // ── grep: execFileSync with an argv array — the pattern/path/include are
    // discrete arguments, never interpolated into a shell string. `--` stops
    // a pattern like "-v" from being read as a flag. ──
    const grepArgs = ["-rIn", "-E"];
    if (args.file_pattern) grepArgs.push(`--include=${args.file_pattern}`);
    grepArgs.push("--exclude-dir=node_modules", "--exclude-dir=.git", "--", args.pattern, dir);
    try {
      const output = execFileSync("grep", grepArgs, {
        encoding: "utf-8",
        timeout: 15_000,
        maxBuffer: 5_000_000,
      });
      return { success: true, output: limitOutput(output) || "(no matches)" };
    } catch (e: unknown) {
      const err = e as { status?: number; stdout?: string; stderr?: string };
      if (err.status === 1) return { success: true, output: "(no matches)" }; // grep: no matches
      return { success: false, output: (err.stderr?.toString() || "grep failed").slice(0, 2000) };
    }
  },
};
