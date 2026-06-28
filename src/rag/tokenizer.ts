/**
 * Tokenizer for BM25 code search.
 * Handles camelCase, snake_case, kebab-case, and plain words.
 */

const CAMEL_LOWER_UPPER = /([a-z])([A-Z])/g;
const CAMEL_MULTI_UPPER = /([A-Z]+)([A-Z][a-z])/g;
const SPLIT_RE = /[\s\-_.:/\\()[\]{}<>,;'"@#$%^&*+=!?`~|]+/;

const STOP_WORDS = new Set([
  "the", "and", "for", "not", "are", "was", "has", "can", "all",
  "will", "from", "this", "that", "with", "been", "have", "its",
  "but", "they", "use", "new", "get", "set", "var", "let", "const",
]);

export function tokenize(text: string): string[] {
  return text
    .replace(CAMEL_LOWER_UPPER, "$1 $2")   // helloWorld → hello World
    .replace(CAMEL_MULTI_UPPER, "$1 $2")   // XMLParser → XML Parser
    .split(SPLIT_RE)
    .flatMap((t) => t.split(/(\d+)/))       // split numbers from words
    .map((t) => t.toLowerCase())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}
