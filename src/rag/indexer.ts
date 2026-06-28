import { readdirSync, statSync, readFileSync } from "fs";
import { join, relative, extname } from "path";
import { tokenize } from "./tokenizer.js";
import { Store, type Chunk } from "./store.js";

// ─── File type sets ───────────────────────────────────────────────────────────

const IGNORED_DIRS = new Set([
  ".git", "node_modules", ".DS_Store", "dist", "build", ".next",
  ".qq", "__pycache__", ".venv", "venv", ".mypy_cache", "coverage",
  ".turbo", ".parcel-cache",
]);

const CODE_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".hpp",
  ".cs", ".php", ".swift", ".kt", ".scala",
  ".sh", ".bash", ".zsh", ".fish",
  ".css", ".scss", ".sass", ".less",
  ".html", ".xml", ".vue", ".svelte",
  ".json", ".yaml", ".yml", ".toml",
  ".graphql", ".gql", ".prisma", ".sql",
]);

const DOC_EXTS = new Set([".md", ".mdx", ".txt", ".rst"]);

const MAX_FILE_BYTES = 500_000;
const CODE_CHUNK_LINES = 50;
const CODE_OVERLAP_LINES = 10;

// ─── Chunking ─────────────────────────────────────────────────────────────────

function makeChunk(
  id: string,
  file: string,
  text: string,
  mtime: number,
): Chunk {
  return { id, file, text, tokens: tokenize(text), mtime };
}

function chunkCode(content: string, relPath: string, mtime: number): Chunk[] {
  const lines = content.split("\n");
  const chunks: Chunk[] = [];
  let i = 0;
  while (i < lines.length) {
    const end = Math.min(i + CODE_CHUNK_LINES, lines.length);
    const text = lines.slice(i, end).join("\n").trim();
    if (text.length > 30) {
      chunks.push(makeChunk(`${relPath}:${i}-${end}`, relPath, `// ${relPath}\n${text}`, mtime));
    }
    i += CODE_CHUNK_LINES - CODE_OVERLAP_LINES;
  }
  return chunks;
}

function chunkDocs(content: string, relPath: string, mtime: number): Chunk[] {
  return content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 40)
    .map((text, i) => makeChunk(`${relPath}:p${i}`, relPath, text, mtime));
}

// ─── File collection ──────────────────────────────────────────────────────────

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return results; }

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry) || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    let stat;
    try { stat = statSync(full); } catch { continue; }
    if (stat.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (stat.isFile()) {
      const ext = extname(full).toLowerCase();
      if (CODE_EXTS.has(ext) || DOC_EXTS.has(ext)) results.push(full);
    }
  }
  return results;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface IndexProgress {
  total: number;
  done: number;
  current: string;
}

export interface IndexResult {
  added: number;
  skipped: number;
  files: number;
}

export function indexProject(
  projectPath: string,
  store: Store,
  onProgress?: (p: IndexProgress) => void,
): IndexResult {
  const files = collectFiles(projectPath);
  let added = 0;
  let skipped = 0;
  let filesIndexed = 0;

  for (let i = 0; i < files.length; i++) {
    const absPath = files[i];
    const relPath = relative(projectPath, absPath);

    onProgress?.({ total: files.length, done: i, current: relPath });

    let stat;
    try { stat = statSync(absPath); } catch { continue; }

    const mtime = stat.mtimeMs;
    const storedMtime = store.getFileMtime(relPath);
    if (storedMtime !== null && storedMtime >= mtime) { skipped++; continue; }
    if (stat.size > MAX_FILE_BYTES) { skipped++; continue; }

    let content: string;
    try { content = readFileSync(absPath, "utf-8"); } catch { continue; }

    const ext = extname(absPath).toLowerCase();
    const chunks = DOC_EXTS.has(ext)
      ? chunkDocs(content, relPath, mtime)
      : chunkCode(content, relPath, mtime);

    if (chunks.length > 0) {
      store.upsert(relPath, chunks);
      added += chunks.length;
      filesIndexed++;
    }
  }

  onProgress?.({ total: files.length, done: files.length, current: "" });
  store.save();
  return { added, skipped, files: filesIndexed };
}
