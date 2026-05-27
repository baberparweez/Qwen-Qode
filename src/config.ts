import { config } from "dotenv";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  config({ path: envPath });
} else {
  config();
}

const homeEnv = join(process.env.HOME ?? "~", ".qwen-qode", ".env");
if (!process.env.OPENROUTER_API_KEY && existsSync(homeEnv)) {
  config({ path: homeEnv });
}

export const API_KEY = process.env.OPENROUTER_API_KEY ?? "";
export const MODEL = process.env.QWEN_MODEL ?? "qwen/qwen-2.5-coder-32b-instruct";
export const BASE_URL = "https://openrouter.ai/api/v1";

export const MAX_TOKENS = 8192;
export const MAX_ITERATIONS = 30;

export function assertApiKey(): void {
  if (!API_KEY) {
    console.error(
      "Missing OPENROUTER_API_KEY. Set it in .env or ~/.qwen-qode/.env"
    );
    process.exit(1);
  }
}
