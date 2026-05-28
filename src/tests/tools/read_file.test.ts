import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { readFileTool } from "../../tools/read_file.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "qq-test-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("read_file", () => {
  it("reads a file and returns numbered lines", async () => {
    writeFileSync(join(tmp, "hello.ts"), "const a = 1;\nconst b = 2;\nconst c = 3;");
    const result = await readFileTool.execute({ path: "hello.ts" }, tmp);
    expect(result.success).toBe(true);
    expect(result.output).toContain("const a = 1;");
    expect(result.output).toContain("   1 |");
    expect(result.output).toContain("   2 |");
    expect(result.output).toContain("   3 |");
  });

  it("returns only the requested line range", async () => {
    writeFileSync(join(tmp, "file.ts"), "line1\nline2\nline3\nline4\nline5");
    const result = await readFileTool.execute({ path: "file.ts", start_line: 2, end_line: 4 }, tmp);
    expect(result.success).toBe(true);
    expect(result.output).toContain("line2");
    expect(result.output).toContain("line3");
    expect(result.output).toContain("line4");
    expect(result.output).not.toContain("line1");
    expect(result.output).not.toContain("line5");
  });

  it("returns failure for a missing file", async () => {
    const result = await readFileTool.execute({ path: "does_not_exist.ts" }, tmp);
    expect(result.success).toBe(false);
    expect(result.output).toContain("not found");
  });

  it("resolves paths relative to the provided cwd", async () => {
    const sub = join(tmp, "src");
    mkdirSync(sub);
    writeFileSync(join(sub, "index.ts"), "export const x = 42;");
    const result = await readFileTool.execute({ path: "src/index.ts" }, tmp);
    expect(result.success).toBe(true);
    expect(result.output).toContain("export const x = 42;");
  });
});
