import React from "react";

/**
 * Zero-dependency syntax highlighter for fenced code blocks.
 * Tokenizes comments, strings, numbers, keywords, builtins, and function calls,
 * mapping each to a colour from the app's dark theme. Covers the common
 * languages; unknown languages fall back to a generic config (strings, numbers,
 * comments) so they still read well.
 */

const COLORS = {
  keyword: "#a78bfa",   // purple (matches the QQ logo)
  builtin: "#6ee7f7",   // cyan accent
  string: "#9ece6a",    // green
  number: "#f78c6c",    // orange
  comment: "#6b6b6b",   // muted, italic
  func: "#82aaff",      // blue
  operator: "#89ddff",  // light cyan
  text: "#e8e8e8",
};

type Lang = {
  keywords: Set<string>;
  builtins: Set<string>;
  line: string[];                  // line-comment prefixes
  block?: [string, string];        // block-comment delimiters
};

function mk(o: { keywords?: string[]; builtins?: string[]; line?: string[]; block?: [string, string] }): Lang {
  return {
    keywords: new Set(o.keywords ?? []),
    builtins: new Set(o.builtins ?? []),
    line: o.line ?? [],
    block: o.block,
  };
}

const JS = mk({
  keywords: [
    "const", "let", "var", "function", "return", "if", "else", "for", "while", "do",
    "switch", "case", "break", "continue", "new", "delete", "typeof", "instanceof",
    "in", "of", "class", "extends", "super", "this", "import", "export", "from", "as",
    "default", "async", "await", "yield", "try", "catch", "finally", "throw", "void",
    "interface", "type", "enum", "implements", "public", "private", "protected",
    "readonly", "static", "abstract", "namespace", "declare", "keyof", "infer",
    "satisfies", "get", "set", "true", "false", "null", "undefined",
  ],
  builtins: [
    "string", "number", "boolean", "object", "any", "unknown", "never", "bigint", "symbol",
    "Array", "Promise", "Record", "Map", "Set", "Object", "Math", "JSON", "console",
    "window", "document", "Date", "RegExp", "Error", "Partial", "Readonly",
  ],
  line: ["//"],
  block: ["/*", "*/"],
});

const PY = mk({
  keywords: [
    "def", "return", "if", "elif", "else", "for", "while", "break", "continue",
    "import", "from", "as", "class", "try", "except", "finally", "raise", "with",
    "lambda", "yield", "global", "nonlocal", "pass", "assert", "del", "in", "is",
    "not", "and", "or", "async", "await", "None", "True", "False",
  ],
  builtins: [
    "print", "len", "range", "int", "str", "float", "list", "dict", "set", "tuple",
    "bool", "self", "super", "type", "isinstance", "enumerate", "zip", "map", "filter",
    "open", "input", "format", "sorted", "sum", "min", "max", "abs",
  ],
  line: ["#"],
});

const BASH = mk({
  keywords: [
    "if", "then", "else", "elif", "fi", "for", "while", "until", "do", "done",
    "case", "esac", "function", "in", "return", "export", "local", "readonly",
    "declare", "source", "alias", "set", "unset",
  ],
  builtins: ["echo", "cd", "ls", "cat", "grep", "sed", "awk", "curl", "mkdir", "rm", "cp", "mv", "git", "npm", "node"],
  line: ["#"],
});

const GO = mk({
  keywords: [
    "func", "return", "if", "else", "for", "range", "switch", "case", "default",
    "break", "continue", "package", "import", "var", "const", "type", "struct",
    "interface", "map", "chan", "go", "defer", "select", "fallthrough", "goto",
    "nil", "true", "false",
  ],
  builtins: ["string", "int", "int64", "float64", "bool", "byte", "rune", "error", "make", "len", "cap", "append", "panic", "recover", "fmt"],
  line: ["//"],
  block: ["/*", "*/"],
});

const RUST = mk({
  keywords: [
    "fn", "let", "mut", "return", "if", "else", "for", "while", "loop", "match",
    "struct", "enum", "trait", "impl", "pub", "use", "mod", "crate", "self", "super",
    "where", "as", "ref", "move", "async", "await", "dyn", "const", "static", "type",
    "unsafe", "true", "false",
  ],
  builtins: ["String", "Vec", "Option", "Result", "Box", "i32", "i64", "u32", "u64", "usize", "f64", "bool", "str", "Some", "None", "Ok", "Err", "println"],
  line: ["//"],
  block: ["/*", "*/"],
});

const JAVA = mk({
  keywords: [
    "public", "private", "protected", "class", "interface", "extends", "implements",
    "return", "if", "else", "for", "while", "do", "switch", "case", "break", "continue",
    "new", "static", "final", "void", "import", "package", "try", "catch", "finally",
    "throw", "throws", "this", "super", "abstract", "synchronized", "volatile",
    "true", "false", "null",
  ],
  builtins: ["String", "Integer", "Boolean", "Double", "List", "Map", "Set", "ArrayList", "HashMap", "System", "Object", "int", "long", "double", "boolean", "char", "byte"],
  line: ["//"],
  block: ["/*", "*/"],
});

const C = mk({
  keywords: [
    "int", "char", "float", "double", "void", "long", "short", "unsigned", "signed",
    "struct", "union", "enum", "typedef", "const", "static", "extern", "return", "if",
    "else", "for", "while", "do", "switch", "case", "break", "continue", "sizeof",
    "goto", "default", "register", "volatile",
  ],
  builtins: ["printf", "scanf", "malloc", "free", "memcpy", "strlen", "strcmp", "NULL", "size_t", "FILE", "true", "false"],
  line: ["//"],
  block: ["/*", "*/"],
});

const RUBY = mk({
  keywords: [
    "def", "end", "return", "if", "elsif", "else", "unless", "case", "when", "while",
    "until", "for", "in", "do", "begin", "rescue", "ensure", "raise", "class", "module",
    "require", "include", "attr_accessor", "attr_reader", "yield", "self", "nil",
    "true", "false", "and", "or", "not", "then",
  ],
  builtins: ["puts", "print", "p", "require_relative", "lambda", "proc", "new", "each", "map", "select"],
  line: ["#"],
});

const SQL = mk({
  keywords: [
    "SELECT", "FROM", "WHERE", "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
    "CREATE", "TABLE", "ALTER", "DROP", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER",
    "ON", "AS", "AND", "OR", "NOT", "NULL", "ORDER", "BY", "GROUP", "HAVING", "LIMIT",
    "DISTINCT", "COUNT", "SUM", "AVG", "MIN", "MAX", "PRIMARY", "KEY", "FOREIGN",
    "REFERENCES", "INDEX", "UNIQUE", "DEFAULT", "INT", "VARCHAR", "TEXT", "BOOLEAN",
    "select", "from", "where", "insert", "into", "values", "update", "set", "delete",
    "create", "table", "join", "on", "and", "or", "not", "null", "order", "by", "group",
  ],
  builtins: [],
  line: ["--"],
  block: ["/*", "*/"],
});

const YAML = mk({
  keywords: ["true", "false", "null", "yes", "no", "on", "off"],
  builtins: [],
  line: ["#"],
});

const JSON_L = mk({ keywords: ["true", "false", "null"], builtins: [] });

const CSS = mk({ keywords: [], builtins: [], block: ["/*", "*/"] });

const GENERIC = mk({ keywords: [], builtins: [], line: ["//", "#"], block: ["/*", "*/"] });

const LANGS: Record<string, Lang> = {
  js: JS, jsx: JS, ts: JS, tsx: JS, javascript: JS, typescript: JS, mjs: JS, cjs: JS,
  py: PY, python: PY,
  sh: BASH, bash: BASH, shell: BASH, zsh: BASH, console: BASH,
  go: GO, golang: GO,
  rs: RUST, rust: RUST,
  java: JAVA,
  c: C, cpp: C, "c++": C, h: C, hpp: C,
  rb: RUBY, ruby: RUBY,
  sql: SQL,
  yaml: YAML, yml: YAML,
  json: JSON_L,
  css: CSS, scss: CSS, sass: CSS, less: CSS,
};

const NUM_RE = /^(0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*\.?\d*([eE][+-]?\d+)?[a-zA-Z%]*)/;
const ID_RE = /^[A-Za-z_$][A-Za-z0-9_$]*/;
const OP_RE = /^[+\-*/%=<>!&|^~?:.@]+/;

export function highlightCode(code: string, langName: string): React.ReactNode {
  const lang = LANGS[langName.toLowerCase()] ?? GENERIC;
  const out: React.ReactNode[] = [];
  let buf = "";
  let key = 0;

  const flush = () => { if (buf) { out.push(buf); buf = ""; } };
  const emit = (text: string, color: string, italic = false) => {
    flush();
    out.push(
      <span key={key++} style={{ color, fontStyle: italic ? "italic" : undefined }}>{text}</span>,
    );
  };

  const n = code.length;
  let i = 0;

  while (i < n) {
    const ch = code[i];
    const rest = code.slice(i);

    // block comment
    if (lang.block && rest.startsWith(lang.block[0])) {
      const end = code.indexOf(lang.block[1], i + lang.block[0].length);
      const stop = end === -1 ? n : end + lang.block[1].length;
      emit(code.slice(i, stop), COLORS.comment, true);
      i = stop;
      continue;
    }

    // line comment
    let lineMatched = false;
    for (const lc of lang.line) {
      if (rest.startsWith(lc)) {
        const nl = code.indexOf("\n", i);
        const stop = nl === -1 ? n : nl;
        emit(code.slice(i, stop), COLORS.comment, true);
        i = stop;
        lineMatched = true;
        break;
      }
    }
    if (lineMatched) continue;

    // string (single / double / backtick)
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < n) {
        if (code[j] === "\\") { j += 2; continue; }
        if (code[j] === ch) { j++; break; }
        j++;
      }
      emit(code.slice(i, j), COLORS.string);
      i = j;
      continue;
    }

    // number
    if (ch >= "0" && ch <= "9") {
      const m = NUM_RE.exec(rest);
      if (m) { emit(m[0], COLORS.number); i += m[0].length; continue; }
    }

    // identifier / keyword / builtin / function
    const idm = ID_RE.exec(rest);
    if (idm) {
      const word = idm[0];
      if (lang.keywords.has(word)) emit(word, COLORS.keyword);
      else if (lang.builtins.has(word)) emit(word, COLORS.builtin);
      else if (/^\s*\(/.test(rest.slice(word.length))) emit(word, COLORS.func);
      else buf += word;
      i += word.length;
      continue;
    }

    // operator
    const opm = OP_RE.exec(rest);
    if (opm) { emit(opm[0], COLORS.operator); i += opm[0].length; continue; }

    // punctuation / whitespace / anything else
    buf += ch;
    i++;
  }

  flush();
  return out;
}
