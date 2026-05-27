import { readdirSync, statSync, existsSync } from "fs";
import { resolve, join, relative } from "path";
import type { Tool, ToolResult } from "./types.js";

const IGNORED = new Set([
  "node_modules", ".git", "dist", "build", ".next", "__pycache__",
  ".cache", "coverage", ".DS_Store", ".turbo", ".vercel",
]);

function walkDir(dir: string, base: string, depth: number, maxDepth: number): string[] {
  if (depth > maxDepth) return [];
  const results: string[] = [];
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return results; }
  for (const entry of entries.sort()) {
    if (IGNORED.has(entry)) continue;
    const full = join(dir, entry);
    const rel = relative(base, full);
    let stat;
    try { stat = statSync(full); } catch { continue; }
    if (stat.isDirectory()) {
      results.push(rel + "/");
      results.push(...walkDir(full, base, depth + 1, maxDepth));
    } else {
      results.push(rel);
    }
  }
  return results;
}

export const listFilesTool: Tool = {
  definition: {
    type: "function",
    function: {
      name: "list_files",
      description:
        "List files and directories in a path, recursively up to a given depth. Ignores node_modules, .git, dist, etc.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Directory to list (absolute or relative to project root). Defaults to project root.",
          },
          depth: {
            type: "number",
            description: "Max recursion depth (default: 3)",
          },
        },
        required: [],
      },
    },
  },

  async execute(args: { path?: string; depth?: number }, cwd: string): Promise<ToolResult> {
    const target = resolve(cwd, args.path ?? ".");
    if (!existsSync(target)) {
      return { success: false, output: `Path not found: ${target}` };
    }
    const files = walkDir(target, target, 0, args.depth ?? 3);
    return { success: true, output: files.length ? files.join("\n") : "(empty directory)" };
  },
};
