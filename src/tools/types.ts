import type OpenAI from "openai";

export interface ToolResult {
  success: boolean;
  output: string;
}

export interface Tool {
  definition: OpenAI.Chat.ChatCompletionTool;
  execute(args: Record<string, unknown>, cwd: string): Promise<ToolResult>;
}
