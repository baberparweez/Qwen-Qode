export type AgentEvent =
  | { type: "text"; content: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; success: boolean; output: string }
  | { type: "error"; message: string }
  | { type: "done" };

export type ToolCallPair = {
  call: { name: string; args: Record<string, unknown> };
  result?: { success: boolean; output: string };
};

export type ChatMessage =
  | { role: "user"; content: string; images?: string[] }
  | { role: "assistant"; content: string; toolCalls?: ToolCallPair[] }
  | { role: "error"; content: string };

export interface Session {
  id: string;
  projectPath: string;
  model: string;
}

export interface ModelOption {
  id: string;
  name: string;
  vision: boolean;
  description: string;
  warning?: string;
}
