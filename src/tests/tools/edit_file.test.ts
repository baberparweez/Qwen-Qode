import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { editFileTool } from "../../tools/edit_file.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "qq-test-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("edit_file", () => {
  it("replaces an exact string in a file", async () => {
    writeFileSync(join(tmp, "app.ts"), "const name = 'Alice';\nconsole.log(name);");
    const result = await editFileTool.execute(
      { path: "app.ts", old_string: "const name = 'Alice';", new_string: "const name = 'Bob';" },
      tmp
    );
    expect(result.success).toBe(true);
    expect(readFileSync(join(tmp, "app.ts"), "utf-8")).toContain("const name = 'Bob';");
  });

  it("fails when old_string is not found", async () => {
    writeFileSync(join(tmp, "app.ts"), "const x = 1;");
    const result = await editFileTool.execute(
      { path: "app.ts", old_string: "const y = 2;", new_string: "const y = 3;" },
      tmp
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain("not found");
  });

  it("fails when old_string appears more than once", async () => {
    writeFileSync(join(tmp, "app.ts"), "foo()\nfoo()");
    const result = await editFileTool.execute(
      { path: "app.ts", old_string: "foo()", new_string: "bar()" },
      tmp
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain("appears 2 times");
  });

  it("fails when the file does not exist", async () => {
    const result = await editFileTool.execute(
      { path: "missing.ts", old_string: "x", new_string: "y" },
      tmp
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain("not found");
  });

  it("preserves content around the replaced string", async () => {
    writeFileSync(join(tmp, "app.ts"), "line1\nTARGET\nline3");
    await editFileTool.execute({ path: "app.ts", old_string: "TARGET", new_string: "REPLACED" }, tmp);
    const content = readFileSync(join(tmp, "app.ts"), "utf-8");
    expect(content).toBe("line1\nREPLACED\nline3");
  });
});
