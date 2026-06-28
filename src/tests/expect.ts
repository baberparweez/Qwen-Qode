/**
 * Minimal expect() shim for use with node:test.
 * Covers the subset of vitest matchers used in this project.
 */
import assert from "node:assert/strict";

interface Matchers {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toBeNull(): void;
  toContain(str: string): void;
  toBeLessThanOrEqual(n: number): void;
  not: {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeNull(): void;
    toContain(str: string): void;
  };
}

export function expect(actual: unknown): Matchers {
  return {
    toBe(expected) {
      assert.strictEqual(actual, expected);
    },
    toEqual(expected) {
      assert.deepStrictEqual(actual, expected);
    },
    toBeNull() {
      assert.strictEqual(actual, null);
    },
    toContain(str) {
      assert.ok(
        typeof actual === "string" && actual.includes(str),
        `Expected "${String(actual)}" to contain "${str}"`,
      );
    },
    toBeLessThanOrEqual(n) {
      assert.ok(
        typeof actual === "number" && actual <= n,
        `Expected ${String(actual)} to be <= ${n}`,
      );
    },
    not: {
      toBe(expected) {
        assert.notStrictEqual(actual, expected);
      },
      toEqual(expected) {
        assert.notDeepStrictEqual(actual, expected);
      },
      toBeNull() {
        assert.notStrictEqual(actual, null);
      },
      toContain(str) {
        assert.ok(
          typeof actual !== "string" || !actual.includes(str),
          `Expected "${String(actual)}" not to contain "${str}"`,
        );
      },
    },
  };
}
