import { config } from "dotenv";
import { existsSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  config({ path: envPath });
} else {
  config();
}

const homeEnv = join(process.env.HOME ?? "~", ".qwen-qode", ".env");
if (!process.env.OPENROUTER_API_KEY && !process.env.QQ_API_KEY && existsSync(homeEnv)) {
  config({ path: homeEnv });
}

// QQ_BASE_URL overrides OpenRouter — point at Ollama, LM Studio, or any OpenAI-compatible server
export const BASE_URL =
  process.env.QQ_BASE_URL ?? "https://openrouter.ai/api/v1";

// QQ_API_KEY is the generic key; OPENROUTER_API_KEY kept for backwards compat.
// Local servers (Ollama, LM Studio) don't need a real key — use "local" as a placeholder.
export const API_KEY =
  process.env.QQ_API_KEY ?? process.env.OPENROUTER_API_KEY ?? "";

export const MODEL =
  process.env.QWEN_MODEL ?? "qwen/qwen-2.5-coder-32b-instruct";

export const MAX_TOKENS = 8192;
export const MAX_ITERATIONS = 30;

const isLocal = BASE_URL.includes("localhost") || BASE_URL.includes("127.0.0.1");

export function assertApiKey(): void {
  if (!API_KEY && !isLocal) {
    console.error(
      "Missing API key.\n" +
      "  For OpenRouter: set OPENROUTER_API_KEY in .env\n" +
      "  For local models: set QQ_BASE_URL=http://localhost:11434/v1 (no key needed)"
    );
    process.exit(1);
  }
}
