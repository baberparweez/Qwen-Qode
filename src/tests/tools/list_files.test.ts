import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { listFilesTool } from "../../tools/list_files.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "qq-test-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("list_files", () => {
  it("lists files and directories in a project", async () => {
    writeFileSync(join(tmp, "index.ts"), "");
    writeFileSync(join(tmp, "README.md"), "");
    mkdirSync(join(tmp, "src"));
    writeFileSync(join(tmp, "src", "app.ts"), "");

    const result = await listFilesTool.execute({}, tmp);
    expect(result.success).toBe(true);
    expect(result.output).toContain("index.ts");
    expect(result.output).toContain("README.md");
    expect(result.output).toContain("src/");
    expect(result.output).toContain("src/app.ts");
  });

  it("ignores node_modules, .git, and dist", async () => {
    writeFileSync(join(tmp, "index.ts"), "");
    mkdirSync(join(tmp, "node_modules"));
    writeFileSync(join(tmp, "node_modules", "pkg.js"), "");
    mkdirSync(join(tmp, ".git"));
    writeFileSync(join(tmp, ".git", "config"), "");
    mkdirSync(join(tmp, "dist"));
    writeFileSync(join(tmp, "dist", "index.js"), "");

    const result = await listFilesTool.execute({}, tmp);
    expect(result.success).toBe(true);
    expect(result.output).not.toContain("node_modules");
    expect(result.output).not.toContain(".git");
    expect(result.output).not.toContain("dist");
    expect(result.output).toContain("index.ts");
  });

  it("respects the depth limit", async () => {
    mkdirSync(join(tmp, "a"));
    mkdirSync(join(tmp, "a", "b"));
    mkdirSync(join(tmp, "a", "b", "c"));
    writeFileSync(join(tmp, "a", "b", "c", "deep.ts"), "");

    const result = await listFilesTool.execute({ depth: 2 }, tmp);
    expect(result.success).toBe(true);
    expect(result.output).toContain("a/");
    expect(result.output).toContain("a/b/");
    // The directory entry a/b/c/ is visible at depth 2, but its contents are not
    expect(result.output).not.toContain("deep.ts");
  });

  it("returns a message for an empty directory", async () => {
    const result = await listFilesTool.execute({}, tmp);
    expect(result.success).toBe(true);
    expect(result.output).toContain("empty");
  });

  it("returns failure for a path that does not exist", async () => {
    const result = await listFilesTool.execute({ path: "nonexistent" }, tmp);
    expect(result.success).toBe(false);
    expect(result.output).toContain("not found");
  });
});
