#!/usr/bin/env node
import { createInterface } from "readline";
import { resolve } from "path";
import { existsSync } from "fs";
import { program } from "commander";
import { assertApiKey, MODEL } from "./config.js";
import { Agent, type AgentEvent } from "./agent.js";
import { ui } from "./ui.js";

program
  .name("qq")
  .description("Qwen Qode — a coding agent powered by Qwen2.5-coder")
  .version("0.1.0")
  .option("-p, --project <path>", "Project directory to work in", process.cwd())
  .option("-m, --message <msg>", "Send a single message and exit (non-interactive)")
  .option("--web", "Start the web UI server instead of the CLI")
  .parse(process.argv);

const opts = program.opts<{ project: string; message?: string; web?: boolean }>();

function handleEvent(event: AgentEvent) {
  switch (event.type) {
    case "text":
      ui.assistantStart();
      ui.assistantText(event.content);
      break;
    case "tool_call":
      ui.toolCall(event.name, event.args);
      break;
    case "tool_result":
      ui.toolResult(event.name, event.success, event.output);
      break;
    case "error":
      ui.error(event.message);
      break;
    case "done":
      break;
  }
}

async function main() {
  if (opts.web) {
    const { startServer } = await import("./server.js");
    await startServer();
    return;
  }

  assertApiKey();

  const projectPath = resolve(opts.project);
  if (!existsSync(projectPath)) {
    ui.error(`Project path does not exist: ${projectPath}`);
    process.exit(1);
  }

  process.chdir(projectPath);

  ui.header();
  ui.info(`Model  : ${MODEL}`);
  ui.info(`Project: ${projectPath}`);
  ui.separator();

  const agent = new Agent(projectPath);

  if (opts.message) {
    ui.thinking();
    await agent.run(opts.message, (e) => {
      ui.clearLine();
      handleEvent(e);
    });
    return;
  }

  ui.info("Type your message and press Enter. Commands: /clear /cd <path> /exit");
  ui.separator();

  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  const askNext = () => ui.prompt(process.cwd());

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) { askNext(); return; }

    if (input === "/exit" || input === "/quit") {
      console.log("\x1b[2m\n  Goodbye!\n\x1b[0m");
      rl.close();
      process.exit(0);
    }

    if (input === "/clear") {
      agent.clearHistory();
      console.clear();
      ui.header();
      ui.info("Conversation cleared.");
      askNext();
      return;
    }

    if (input.startsWith("/cd ")) {
      const newPath = resolve(process.cwd(), input.slice(4).trim());
      if (existsSync(newPath)) {
        agent.setCwd(newPath);
        ui.info(`Changed directory to: ${newPath}`);
      } else {
        ui.error(`Path not found: ${newPath}`);
      }
      askNext();
      return;
    }

    if (input === "/history") {
      const msgs = agent.getMessages().filter((m) => m.role !== "system");
      console.log(`\n  ${msgs.length} messages in history.\n`);
      askNext();
      return;
    }

    rl.pause();
    ui.thinking();
    try {
      await agent.run(input, (e) => {
        ui.clearLine();
        handleEvent(e);
      });
    } catch (e) {
      ui.clearLine();
      ui.error(String(e));
    }
    rl.resume();
    askNext();
  });

  rl.on("close", () => { console.log("\n  Session ended.\n"); process.exit(0); });

  askNext();
}

main().catch((e) => { ui.error(String(e)); process.exit(1); });
