import { describe, it, beforeEach, afterEach } from "node:test";
import { expect } from "../expect.js";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { writeFileTool } from "../../tools/write_file.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "qq-test-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("write_file", () => {
  it("creates a new file with the given content", async () => {
    const result = await writeFileTool.execute({ path: "output.ts", content: "export const x = 1;" }, tmp);
    expect(result.success).toBe(true);
    expect(readFileSync(join(tmp, "output.ts"), "utf-8")).toBe("export const x = 1;");
  });

  it("overwrites an existing file", async () => {
    const filePath = join(tmp, "existing.ts");
    const result1 = await writeFileTool.execute({ path: "existing.ts", content: "old content" }, tmp);
    expect(result1.success).toBe(true);
    const result2 = await writeFileTool.execute({ path: "existing.ts", content: "new content" }, tmp);
    expect(result2.success).toBe(true);
    expect(readFileSync(filePath, "utf-8")).toBe("new content");
  });

  it("creates parent directories automatically", async () => {
    const result = await writeFileTool.execute({ path: "a/b/c/deep.ts", content: "deep" }, tmp);
    expect(result.success).toBe(true);
    expect(existsSync(join(tmp, "a/b/c/deep.ts"))).toBe(true);
  });

  it("resolves paths relative to the provided cwd", async () => {
    const result = await writeFileTool.execute({ path: "relative.ts", content: "hello" }, tmp);
    expect(result.success).toBe(true);
    expect(existsSync(join(tmp, "relative.ts"))).toBe(true);
  });
});
