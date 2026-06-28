import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { tokenize } from "./tokenizer.js";

export interface Chunk {
  id: string;
  file: string;
  text: string;
  tokens: string[];  // pre-tokenized at index time
  mtime: number;
}

interface StoredData {
  version: number;
  chunks: Chunk[];
}

// BM25 parameters (Robertson & Zaragoza, 2009)
const K1 = 1.5;
const B = 0.75;

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
      const raw = JSON.parse(readFileSync(this.indexPath, "utf-8")) as StoredData;
      if (raw.version === 2 && Array.isArray(raw.chunks)) {
        this.chunks = raw.chunks;
      }
    } catch {
      this.chunks = [];
    }
  }

  save() {
    const dir = dirname(this.indexPath);
    mkdirSync(dir, { recursive: true });
    writeFileSync(this.indexPath, JSON.stringify({ version: 2, chunks: this.chunks }));
  }

  upsert(file: string, newChunks: Chunk[]) {
    this.chunks = this.chunks.filter((c) => c.file !== file);
    this.chunks.push(...newChunks);
  }

  removeFile(file: string) {
    this.chunks = this.chunks.filter((c) => c.file !== file);
  }

  getFileMtime(file: string): number | null {
    return this.chunks.find((c) => c.file === file)?.mtime ?? null;
  }

  getFiles(): string[] {
    return [...new Set(this.chunks.map((c) => c.file))];
  }

  size(): number {
    return this.chunks.length;
  }

  search(query: string, topK = 5): Array<{ chunk: Chunk; score: number }> {
    if (this.chunks.length === 0) return [];

    const queryTerms = tokenize(query);
    if (queryTerms.length === 0) return [];

    const N = this.chunks.length;
    const avgLen = this.chunks.reduce((s, c) => s + c.tokens.length, 0) / N;

    // Document frequency: how many chunks contain each query term
    const df = new Map<string, number>();
    for (const chunk of this.chunks) {
      const seen = new Set<string>();
      for (const t of chunk.tokens) {
        if (!seen.has(t) && queryTerms.includes(t)) {
          df.set(t, (df.get(t) ?? 0) + 1);
          seen.add(t);
        }
      }
    }

    const results: Array<{ chunk: Chunk; score: number }> = [];

    for (const chunk of this.chunks) {
      // Term frequencies within this chunk
      const tf = new Map<string, number>();
      for (const t of chunk.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

      let score = 0;
      const docLen = chunk.tokens.length;

      for (const term of queryTerms) {
        const termTf = tf.get(term) ?? 0;
        if (termTf === 0) continue;
        const termDf = df.get(term) ?? 0;
        if (termDf === 0) continue;

        const idf = Math.log((N - termDf + 0.5) / (termDf + 0.5) + 1);
        const tfNorm =
          (termTf * (K1 + 1)) /
          (termTf + K1 * (1 - B + B * (docLen / avgLen)));
        score += idf * tfNorm;
      }

      if (score > 0) results.push({ chunk, score });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}
