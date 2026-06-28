import { describe, it, beforeEach, afterEach } from "node:test";
import { expect } from "../expect.js";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execFileSync } from "child_process";
import { gitTool } from "../../tools/git.js";

let tmp: string;

function git(args: string[], cwd: string) {
  execFileSync("git", args, { cwd, stdio: "pipe" });
}

function initRepo(dir: string) {
  git(["init"], dir);
  git(["config", "user.email", "test@test.com"], dir);
  git(["config", "user.name", "Test"], dir);
  git(["config", "commit.gpgsign", "false"], dir);
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "qq-git-"));
  initRepo(tmp);
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("git tool", () => {
  it("status shows untracked files", async () => {
    writeFileSync(join(tmp, "new.ts"), "export const x = 1;");
    const result = await gitTool.execute({ operation: "status" }, tmp);
    expect(result.success).toBe(true);
    expect(result.output).toContain("new.ts");
  });

  it("add stages a file", async () => {
    writeFileSync(join(tmp, "a.ts"), "const a = 1;");
    const result = await gitTool.execute({ operation: "add", files: ["a.ts"] }, tmp);
    expect(result.success).toBe(true);
    expect(result.output).toContain("Staged");
    const status = await gitTool.execute({ operation: "status" }, tmp);
    expect(status.output).toContain("a.ts");
  });

  it("commit creates a commit that appears in log", async () => {
    writeFileSync(join(tmp, "a.ts"), "const a = 1;");
    await gitTool.execute({ operation: "add", files: ["a.ts"] }, tmp);
    const commit = await gitTool.execute({ operation: "commit", message: "feat: add a.ts" }, tmp);
    expect(commit.success).toBe(true);
    const log = await gitTool.execute({ operation: "log" }, tmp);
    expect(log.success).toBe(true);
    expect(log.output).toContain("feat: add a.ts");
  });

  it("commit with all:true stages tracked modifications", async () => {
    writeFileSync(join(tmp, "a.ts"), "const a = 1;");
    await gitTool.execute({ operation: "add", files: ["a.ts"] }, tmp);
    await gitTool.execute({ operation: "commit", message: "initial" }, tmp);
    writeFileSync(join(tmp, "a.ts"), "const a = 2;");
    const commit = await gitTool.execute({ operation: "commit", message: "update", all: true }, tmp);
    expect(commit.success).toBe(true);
    const log = await gitTool.execute({ operation: "log" }, tmp);
    expect(log.output).toContain("update");
  });

  it("diff shows unstaged changes to tracked files", async () => {
    writeFileSync(join(tmp, "a.ts"), "const a = 1;");
    await gitTool.execute({ operation: "add", files: ["a.ts"] }, tmp);
    await gitTool.execute({ operation: "commit", message: "initial" }, tmp);
    writeFileSync(join(tmp, "a.ts"), "const a = 999;");
    const diff = await gitTool.execute({ operation: "diff" }, tmp);
    expect(diff.success).toBe(true);
    expect(diff.output).toContain("999");
  });

  it("diff staged:true shows staged changes", async () => {
    writeFileSync(join(tmp, "a.ts"), "const a = 1;");
    await gitTool.execute({ operation: "add", files: ["a.ts"] }, tmp);
    const diff = await gitTool.execute({ operation: "diff", staged: true }, tmp);
    expect(diff.success).toBe(true);
    expect(diff.output).toContain("const a = 1;");
  });

  it("show displays a commit", async () => {
    writeFileSync(join(tmp, "a.ts"), "const a = 1;");
    await gitTool.execute({ operation: "add", files: ["a.ts"] }, tmp);
    await gitTool.execute({ operation: "commit", message: "the commit msg" }, tmp);
    const show = await gitTool.execute({ operation: "show" }, tmp);
    expect(show.success).toBe(true);
    expect(show.output).toContain("the commit msg");
  });

  it("branch lists branches", async () => {
    writeFileSync(join(tmp, "a.ts"), "const a = 1;");
    await gitTool.execute({ operation: "add", files: ["a.ts"] }, tmp);
    await gitTool.execute({ operation: "commit", message: "initial" }, tmp);
    const branch = await gitTool.execute({ operation: "branch" }, tmp);
    expect(branch.success).toBe(true);
  });

  it("commit without a message fails", async () => {
    const result = await gitTool.execute({ operation: "commit" }, tmp);
    expect(result.success).toBe(false);
    expect(result.output).toContain("message");
  });

  it("add with empty files fails", async () => {
    const result = await gitTool.execute({ operation: "add", files: [] }, tmp);
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported operation", async () => {
    const result = await gitTool.execute({ operation: "push" }, tmp);
    expect(result.success).toBe(false);
    expect(result.output).toContain("Unsupported");
  });

  it("rejects flag-injection in file paths", async () => {
    const result = await gitTool.execute({ operation: "add", files: ["--all"] }, tmp);
    expect(result.success).toBe(false);
    expect(result.output).toContain("Invalid");
  });

  it("reports a clear error outside a git repository", async () => {
    const nonRepo = mkdtempSync(join(tmpdir(), "qq-nogit-"));
    try {
      const result = await gitTool.execute({ operation: "status" }, nonRepo);
      expect(result.success).toBe(false);
      expect(result.output).toContain("not a git repository");
    } finally {
      rmSync(nonRepo, { recursive: true, force: true });
    }
  });
});
