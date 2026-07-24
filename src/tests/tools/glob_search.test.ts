import { describe, it, beforeEach, afterEach } from "node:test";
import { expect } from "../expect.js";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { globSearchTool } from "../../tools/glob_search.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "qq-test-"));
  mkdirSync(join(tmp, "src"));
  writeFileSync(join(tmp, "src", "index.ts"), "export const hello = 'world';");
  writeFileSync(join(tmp, "src", "utils.ts"), "export function add(a: number, b: number) { return a + b; }");
  writeFileSync(join(tmp, "README.md"), "# My Project");
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("glob_search", () => {
  it("finds files by name pattern (glob)", async () => {
    const result = await globSearchTool.execute({ pattern: "*.ts", search_type: "glob" }, tmp);
    expect(result.success).toBe(true);
    expect(result.output).toContain("index.ts");
    expect(result.output).toContain("utils.ts");
  });

  it("does not include non-matching files in glob results", async () => {
    const result = await globSearchTool.execute({ pattern: "*.ts", search_type: "glob" }, tmp);
    expect(result.output).not.toContain("README.md");
  });

  it("greps for a string across files", async () => {
    const result = await globSearchTool.execute(
      { pattern: "hello", search_type: "grep" },
      tmp
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain("index.ts");
    expect(result.output).toContain("hello");
  });

  it("grep returns no matches for a string that does not exist", async () => {
    const result = await globSearchTool.execute(
      { pattern: "ZZZNOMATCH", search_type: "grep" },
      tmp
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain("no matches");
  });

  it("grep can be restricted to a specific file pattern", async () => {
    writeFileSync(join(tmp, "README.md"), "export const hello = 'from md';");
    const result = await globSearchTool.execute(
      { pattern: "hello", search_type: "grep", file_pattern: "*.ts" },
      tmp
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain("index.ts");
    expect(result.output).not.toContain("README.md");
  });

  it("glob ignores node_modules", async () => {
    mkdirSync(join(tmp, "node_modules"));
    writeFileSync(join(tmp, "node_modules", "dep.ts"), "x");
    const result = await globSearchTool.execute({ pattern: "*.ts", search_type: "glob" }, tmp);
    expect(result.output).not.toContain("node_modules");
  });
});

describe("glob_search — injection safety", () => {
  it("does NOT execute shell metacharacters in a grep pattern", async () => {
    const sentinel = join(tmp, "PWNED");
    await globSearchTool.execute(
      { pattern: `x"; touch "${sentinel}`, search_type: "grep" },
      tmp
    );
    expect(existsSync(sentinel)).toBe(false);
  });

  it("does NOT execute a command substitution in a grep pattern", async () => {
    const sentinel = join(tmp, "PWNED2");
    await globSearchTool.execute(
      { pattern: `$(touch ${sentinel})`, search_type: "grep" },
      tmp
    );
    expect(existsSync(sentinel)).toBe(false);
  });
});
