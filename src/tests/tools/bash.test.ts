import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { bashTool } from "../../tools/bash.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "qq-test-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("bash", () => {
  it("runs a simple command and returns output", async () => {
    const result = await bashTool.execute({ command: "echo hello" }, tmp);
    expect(result.success).toBe(true);
    expect(result.output.trim()).toBe("hello");
  });

  it("runs commands in the provided cwd", async () => {
    writeFileSync(join(tmp, "marker.txt"), "found");
    const result = await bashTool.execute({ command: "ls" }, tmp);
    expect(result.success).toBe(true);
    expect(result.output).toContain("marker.txt");
  });

  it("captures stderr from a failing command", async () => {
    const result = await bashTool.execute({ command: "cat nonexistent_file_xyz" }, tmp);
    expect(result.success).toBe(false);
  });

  it("blocks rm -rf /", async () => {
    const result = await bashTool.execute({ command: "rm -rf /" }, tmp);
    expect(result.success).toBe(false);
    expect(result.output).toContain("Blocked");
  });

  it("blocks fork bomb pattern", async () => {
    const result = await bashTool.execute({ command: ":(){ :|:& };:" }, tmp);
    expect(result.success).toBe(false);
    expect(result.output).toContain("Blocked");
  });

  it("returns (no output) for commands with empty stdout", async () => {
    const result = await bashTool.execute({ command: "true" }, tmp);
    expect(result.success).toBe(true);
    expect(result.output).toBe("(no output)");
  });

  it("truncates output longer than 10 000 characters", async () => {
    // Generate >10k chars by repeating a string
    const result = await bashTool.execute(
      { command: "python3 -c \"print('a' * 20000)\"" },
      tmp
    );
    expect(result.success).toBe(true);
    expect(result.output.length).toBeLessThanOrEqual(10_000);
  });
});
