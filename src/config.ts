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

export const BASE_URL =
  process.env.QQ_BASE_URL ?? "https://openrouter.ai/api/v1";

export const TAVILY_API_KEY = process.env.TAVILY_API_KEY ?? "";

export const API_KEY =
  process.env.QQ_API_KEY ?? process.env.OPENROUTER_API_KEY ?? "";

export const MODEL =
  process.env.QWEN_MODEL ?? "qwen/qwen-2.5-coder-32b-instruct";

export const MAX_TOKENS = 8192;
export const MAX_ITERATIONS = 30;

const isLocal = BASE_URL.includes("localhost") || BASE_URL.includes("127.0.0.1");

export interface ModelOption {
  id: string;
  name: string;
  vision: boolean;
  description: string;
  warning?: string;
}

export const MODELS: ModelOption[] = [
  {
    id: "qwen/qwen-2.5-coder-32b-instruct",
    name: "Qwen2.5 Coder 32B",
    vision: false,
    description: "Optimised for code — recommended for most tasks",
  },
  {
    id: "z-ai/glm-5.2",
    name: "GLM-5.2",
    vision: false,
    description: "Reasoning model from Z.ai — strong all-round coding (its thinking is hidden in the UI)",
  },
  {
    id: "qwen/qwen2.5-vl-72b-instruct",
    name: "Qwen2.5 VL 72B",
    vision: true,
    description: "Vision + language — can analyse screenshots and diagrams",
    warning: "This model supports images but is not specifically fine-tuned for coding. It may be less accurate on complex code tasks than the Coder model.",
  },
  {
    id: "qwen/qwen2.5-vl-7b-instruct",
    name: "Qwen2.5 VL 7B",
    vision: true,
    description: "Vision + language, faster and cheaper — good for quick image questions",
    warning: "This model supports images but is not specifically fine-tuned for coding. It may be less accurate on complex code tasks than the Coder model.",
  },
];

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
