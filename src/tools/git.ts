import { execFileSync } from "child_process";
import type { Tool, ToolResult } from "./types.js";

type GitOp = "status" | "diff" | "log" | "branch" | "show" | "add" | "commit";

const READ_OPS = new Set<GitOp>(["status", "diff", "log", "branch", "show"]);
const ALL_OPS = new Set<GitOp>([...READ_OPS, "add", "commit"]);

type GitArgs = {
  operation: GitOp;
  path?: string;        // diff / log: scope to a file or dir
  staged?: boolean;     // diff: show staged changes instead of unstaged
  count?: number;       // log: number of commits (default 15)
  ref?: string;         // show: commit/ref to display (default HEAD)
  files?: string[];     // add: files to stage
  message?: string;     // commit: commit message
  all?: boolean;        // commit: stage all tracked modifications first (-a)
};

/** Reject values that could be parsed as git options (flag injection). */
function isUnsafe(v: string): boolean {
  return v.startsWith("-");
}

function run(cwd: string, gitArgs: string[]): ToolResult {
  try {
    const output = execFileSync("git", gitArgs, {
      cwd,
      encoding: "utf-8",
      timeout: 30_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const trimmed = output.slice(0, 10_000);
    return {
      success: true,
      output: (trimmed || "(no output)") + (output.length > 10_000 ? "\n…(truncated)" : ""),
    };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const out = [err.stdout, err.stderr].filter(Boolean).join("\n").trim();
    if (/not a git repository/i.test(out)) {
      return { success: false, output: "This project is not a git repository. Run `git init` first (via the bash tool)." };
    }
    return { success: false, output: out.slice(0, 10_000) || err.message || "git command failed" };
  }
}

export const gitTool: Tool = {
  definition: {
    type: "function",
    function: {
      name: "git",
      description:
        "Run a safe git operation in the project. Supported operations: " +
        "'status' (working tree summary), 'diff' (changes — set staged:true for staged), " +
        "'log' (recent commits, use count), 'branch' (list branches), 'show' (a commit, use ref), " +
        "'add' (stage files, use files[]), 'commit' (commit staged changes, requires message; set all:true to stage tracked edits first). " +
        "Destructive operations (push, reset, rebase, force) are intentionally NOT available here — use the bash tool only if the user explicitly asks.",
      parameters: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            description: "One of: status, diff, log, branch, show, add, commit",
          },
          path: { type: "string", description: "diff/log only: scope to this file or directory" },
          staged: { type: "boolean", description: "diff only: show staged (cached) changes instead of unstaged" },
          count: { type: "number", description: "log only: number of commits to show (default 15, max 100)" },
          ref: { type: "string", description: "show only: commit hash or ref to display (default HEAD)" },
          files: { type: "array", description: "add only: list of file paths to stage" },
          message: { type: "string", description: "commit only: the commit message (required for commit)" },
          all: { type: "boolean", description: "commit only: stage all tracked modifications before committing (-a)" },
        },
        required: ["operation"],
      },
    },
  },

  async execute(args: GitArgs, cwd: string): Promise<ToolResult> {
    const op = args.operation;
    if (!ALL_OPS.has(op)) {
      return { success: false, output: `Unsupported git operation: "${op}". Supported: ${[...ALL_OPS].join(", ")}.` };
    }

    switch (op) {
      case "status":
        return run(cwd, ["status", "--short", "--branch"]);

      case "diff": {
        const a = ["diff"];
        if (args.staged) a.push("--staged");
        if (args.path) {
          if (isUnsafe(args.path)) return { success: false, output: "Invalid path." };
          a.push("--", args.path);
        }
        return run(cwd, a);
      }

      case "log": {
        const count = Math.min(Math.max(args.count ?? 15, 1), 100);
        const a = ["log", `-n${count}`, "--oneline", "--decorate"];
        if (args.path) {
          if (isUnsafe(args.path)) return { success: false, output: "Invalid path." };
          a.push("--", args.path);
        }
        return run(cwd, a);
      }

      case "branch":
        return run(cwd, ["branch", "-vv", "--all"]);

      case "show": {
        const ref = args.ref ?? "HEAD";
        if (isUnsafe(ref)) return { success: false, output: "Invalid ref." };
        return run(cwd, ["show", "--stat", ref]);
      }

      case "add": {
        const files = args.files ?? [];
        if (files.length === 0) return { success: false, output: "add requires a non-empty files[] array." };
        if (files.some((f) => typeof f !== "string" || isUnsafe(f))) {
          return { success: false, output: "Invalid file path in files[]." };
        }
        const res = run(cwd, ["add", "--", ...files]);
        return res.success ? { success: true, output: `Staged: ${files.join(", ")}` } : res;
      }

      case "commit": {
        if (!args.message?.trim()) return { success: false, output: "commit requires a non-empty message." };
        const a = ["commit"];
        if (args.all) a.push("-a");
        a.push("-m", args.message);
        return run(cwd, a);
      }
    }
  },
};
