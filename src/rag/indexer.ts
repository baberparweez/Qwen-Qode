import { readdirSync, statSync, readFileSync } from "fs";
import { join, relative, extname } from "path";
import { embed } from "./embedder.js";
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
  ".graphql", ".gql", ".prisma",
  ".sql",
]);

const DOC_EXTS = new Set([".md", ".mdx", ".txt", ".rst"]);

const MAX_FILE_BYTES = 500_000; // skip files > 500 KB

// ─── Chunking ─────────────────────────────────────────────────────────────────

const CODE_CHUNK_LINES = 50;
const CODE_OVERLAP_LINES = 10;

function chunkCode(
  content: string,
  relPath: string,
  mtime: number,
): Omit<Chunk, "embedding">[] {
  const lines = content.split("\n");
  const chunks: Omit<Chunk, "embedding">[] = [];
  let i = 0;

  while (i < lines.length) {
    const end = Math.min(i + CODE_CHUNK_LINES, lines.length);
    const text = lines.slice(i, end).join("\n").trim();
    if (text.length > 30) {
      chunks.push({
        id: `${relPath}:${i}-${end}`,
        file: relPath,
        // Prefix the file path so the model sees context about where this is from
        text: `// ${relPath}\n${text}`,
        mtime,
      });
    }
    i += CODE_CHUNK_LINES - CODE_OVERLAP_LINES;
  }

  return chunks;
}

function chunkDocs(
  content: string,
  relPath: string,
  mtime: number,
): Omit<Chunk, "embedding">[] {
  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 40);

  return paragraphs.map((text, i) => ({
    id: `${relPath}:p${i}`,
    file: relPath,
    text,
    mtime,
  }));
}

// ─── File collection ──────────────────────────────────────────────────────────

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry) || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (stat.isFile()) {
      const ext = extname(full).toLowerCase();
      if (CODE_EXTS.has(ext) || DOC_EXTS.has(ext)) {
        results.push(full);
      }
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

export async function indexProject(
  projectPath: string,
  store: Store,
  onProgress?: (p: IndexProgress) => void,
): Promise<IndexResult> {
  const files = collectFiles(projectPath);
  let added = 0;
  let skipped = 0;
  let filesIndexed = 0;

  for (let i = 0; i < files.length; i++) {
    const absPath = files[i];
    const relPath = relative(projectPath, absPath);

    onProgress?.({ total: files.length, done: i, current: relPath });

    let stat;
    try {
      stat = statSync(absPath);
    } catch {
      continue;
    }

    const mtime = stat.mtimeMs;
    const storedMtime = store.getFileMtime(relPath);

    // Skip unchanged files (mtime-based incremental)
    if (storedMtime !== null && storedMtime >= mtime) {
      skipped++;
      continue;
    }

    if (stat.size > MAX_FILE_BYTES) {
      skipped++;
      continue;
    }

    let content: string;
    try {
      content = readFileSync(absPath, "utf-8");
    } catch {
      continue;
    }

    const ext = extname(absPath).toLowerCase();
    const rawChunks = DOC_EXTS.has(ext)
      ? chunkDocs(content, relPath, mtime)
      : chunkCode(content, relPath, mtime);

    const embedded: Chunk[] = [];
    for (const raw of rawChunks) {
      try {
        const embedding = await embed(raw.text);
        embedded.push({ ...raw, embedding });
      } catch {
        // skip chunk on embed error
      }
    }

    if (embedded.length > 0) {
      store.upsert(relPath, embedded);
      added += embedded.length;
      filesIndexed++;
    }
  }

  onProgress?.({ total: files.length, done: files.length, current: "" });
  store.save();

  return { added, skipped, files: filesIndexed };
}
