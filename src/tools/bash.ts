import { execSync } from "child_process";
import type { Tool, ToolResult } from "./types.js";

const BLOCKED = [
  /rm\s+-rf\s+\/(?!\S)/,
  />\s*\/dev\/sd/,
  /mkfs/,
  /dd\s+if=/,
  /:(){ :|:& };:/,
];

export const bashTool: Tool = {
  definition: {
    type: "function",
    function: {
      name: "bash",
      description:
        "Execute a shell command in the project directory. Output is capped at 10 000 characters.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The shell command to run" },
          timeout_ms: { type: "number", description: "Timeout in milliseconds (default: 30000, max: 120000)" },
        },
        required: ["command"],
      },
    },
  },

  async execute(args: { command: string; timeout_ms?: number }, cwd: string): Promise<ToolResult> {
    for (const pattern of BLOCKED) {
      if (pattern.test(args.command)) {
        return { success: false, output: "Blocked: command matched dangerous pattern." };
      }
    }
    const timeout = Math.min(args.timeout_ms ?? 30_000, 120_000);
    try {
      const output = execSync(args.command, {
        cwd,
        timeout,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      return { success: true, output: output.slice(0, 10_000) || "(no output)" };
    } catch (e: unknown) {
      const err = e as { stdout?: string; stderr?: string; message?: string };
      const out = [err.stdout, err.stderr, err.message].filter(Boolean).join("\n");
      return { success: false, output: out.slice(0, 10_000) || "Command failed" };
    }
  },
};
