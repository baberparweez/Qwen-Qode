import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";

export interface Chunk {
  id: string;        // unique — "{relative_file}:{start}-{end}"
  file: string;      // relative path within project
  text: string;      // the raw text that was embedded
  embedding: number[];
  mtime: number;     // file mtime at time of indexing (ms)
}

interface PersistedStore {
  version: number;
  chunks: Chunk[];
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = a.length;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class Store {
  private chunks: Chunk[] = [];
  private indexPath: string;

  constructor(projectPath: string) {
    this.indexPath = join(projectPath, ".qq", "index.json");
    this.load();
  }

  private load() {
    if (!existsSync(this.indexPath)) return;
    try {
      const raw = JSON.parse(readFileSync(this.indexPath, "utf-8")) as PersistedStore;
      if (raw.version === 1 && Array.isArray(raw.chunks)) {
        this.chunks = raw.chunks;
      }
    } catch {
      // corrupt index — start fresh
      this.chunks = [];
    }
  }

  save() {
    const dir = dirname(this.indexPath);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      this.indexPath,
      JSON.stringify({ version: 1, chunks: this.chunks }),
    );
  }

  /** Replace all chunks belonging to `file` with new chunks. */
  upsert(file: string, newChunks: Chunk[]) {
    this.chunks = this.chunks.filter((c) => c.file !== file);
    this.chunks.push(...newChunks);
  }

  removeFile(file: string) {
    this.chunks = this.chunks.filter((c) => c.file !== file);
  }

  /** Return the stored mtime for the first chunk of a file, or null if unknown. */
  getFileMtime(file: string): number | null {
    return this.chunks.find((c) => c.file === file)?.mtime ?? null;
  }

  getFiles(): string[] {
    return [...new Set(this.chunks.map((c) => c.file))];
  }

  size(): number {
    return this.chunks.length;
  }

  search(
    queryEmbedding: number[],
    topK = 5,
  ): Array<{ chunk: Chunk; score: number }> {
    if (this.chunks.length === 0) return [];
    return this.chunks
      .map((chunk) => ({ chunk, score: cosine(queryEmbedding, chunk.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}
