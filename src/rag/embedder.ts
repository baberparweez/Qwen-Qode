/**
 * Thin wrapper around @xenova/transformers for local text embeddings.
 * Model: Xenova/all-MiniLM-L6-v2 (~25 MB, downloaded once and cached).
 * Produces 384-dimensional normalised vectors.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EmbedFn = (text: string, options: Record<string, unknown>) => Promise<any>;

let _pipeline: EmbedFn | null = null;
let _loading: Promise<EmbedFn> | null = null;

async function getPipeline(): Promise<EmbedFn> {
  if (_pipeline) return _pipeline;
  if (_loading) return _loading;

  _loading = (async () => {
    const { pipeline } = await import("@xenova/transformers");
    const pipe = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    _pipeline = pipe as unknown as EmbedFn;
    return _pipeline;
  })();

  return _loading;
}

export async function embed(text: string): Promise<number[]> {
  const pipe = await getPipeline();
  const output = await pipe(text, { pooling: "mean", normalize: true });
  // output.data is a Float32Array (or regular Array) of length 384
  return Array.from(output.data as ArrayLike<number>);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const t of texts) {
    results.push(await embed(t));
  }
  return results;
}

/** Warm up the model so the first real call is fast. */
export async function warmup(): Promise<void> {
  await embed("warmup");
}
