import type OpenAI from "openai";
import { readFileTool } from "./read_file.js";
import { writeFileTool } from "./write_file.js";
import { editFileTool } from "./edit_file.js";
import { listFilesTool } from "./list_files.js";
import { bashTool } from "./bash.js";
import { globSearchTool } from "./glob_search.js";
import type { Tool, ToolResult } from "./types.js";

export type { Tool, ToolResult };

const registry: Tool[] = [
  readFileTool,
  writeFileTool,
  editFileTool,
  listFilesTool,
  bashTool,
  globSearchTool,
];

export const toolDefinitions: OpenAI.Chat.ChatCompletionTool[] = registry.map((t) => t.definition);

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  cwd: string,
): Promise<ToolResult> {
  const tool = registry.find((t) => t.definition.function.name === name);
  if (!tool) {
    return { success: false, output: `Unknown tool: ${name}` };
  }
  return tool.execute(args, cwd);
}
