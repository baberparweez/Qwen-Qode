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
  process.env.QWEN_MODEL ?? "qwen/qwen3-coder-30b-a3b-instruct";

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
    id: "qwen/qwen3-coder-30b-a3b-instruct",
    name: "Qwen3 Coder 30B",
    vision: false,
    description: "Fast, low-cost coding model — recommended for most tasks",
  },
  {
    id: "qwen/qwen3-coder",
    name: "Qwen3 Coder 480B",
    vision: false,
    description: "Flagship coding model — highest quality, higher cost",
  },
  {
    id: "z-ai/glm-5.2",
    name: "GLM-5.2",
    vision: false,
    description: "Reasoning model from Z.ai — strong all-round coding (its thinking is hidden in the UI)",
  },
  {
    id: "qwen/qwen3-vl-235b-a22b-instruct",
    name: "Qwen3 VL 235B",
    vision: true,
    description: "Vision + language — best for analysing screenshots and diagrams",
    warning: "This model supports images but is not specifically fine-tuned for coding. It may be less accurate on complex code tasks than the Coder models.",
  },
  {
    id: "qwen/qwen3-vl-8b-instruct",
    name: "Qwen3 VL 8B",
    vision: true,
    description: "Vision + language, faster and cheaper — good for quick image questions",
    warning: "This model supports images but is not specifically fine-tuned for coding. It may be less accurate on complex code tasks than the Coder models.",
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
