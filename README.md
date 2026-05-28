# Qwen Qode

A local AI coding agent powered by [Qwen2.5-coder](https://huggingface.co/Qwen/Qwen2.5-Coder-32B-Instruct) via [OpenRouter](https://openrouter.ai). Open any project folder and chat with an agent that can read files, write code, run shell commands, and search your codebase — all through a clean browser UI or a terminal CLI.

![Qwen Qode UI](https://raw.githubusercontent.com/baberparweez/qwen-qode/main/docs/screenshot.png)

---

## Features

- **Browser UI** — dark-themed chat interface with streaming responses
- **Collapsible tool calls** — see exactly which files were read or commands run
- **Folder browser** — click through your filesystem to open any project
- **Terminal CLI** — `qq` command for scripting and headless use
- **6 built-in tools** — read, write, edit, list, bash, and search
- **No local GPU required** — runs Qwen2.5-coder-32B via OpenRouter's cloud API
- **ReAct agent loop** — iterative tool use until the task is complete (up to 30 rounds)

---

## How it works

```
Browser UI (localhost:3000)
       │  SSE stream
       ▼
Backend server (localhost:3579)
       │  per-session Agent instance
       ▼
  Agent loop
  ┌─ Call Qwen2.5-coder via OpenRouter
  ├─ Parse tool call from response (JSON in <tool_call> tags or raw JSON)
  ├─ Execute tool against the selected project folder
  ├─ Inject result back as context
  └─ Repeat until final answer
```

The agent uses a **ReAct-style prompting** approach — no native function-calling API required. The model emits structured JSON, we parse it, execute the tool, and feed the result back as a user message. This works reliably with Qwen2.5-coder-32B and requires no special provider support.

---

## Prerequisites

- **Node.js** ≥ 18 (tested on v22)
- An **[OpenRouter](https://openrouter.ai)** account and API key — free tier works

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/baberparweez/qwen-qode.git
cd qwen-qode
npm install
cd web && npm install && cd ..
```

### 2. Add your API key

```bash
cp .env.example .env
```

Open `.env` and set your key:

```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
QWEN_MODEL=qwen/qwen-2.5-coder-32b-instruct
```

You can get a free API key at [openrouter.ai/keys](https://openrouter.ai/keys). The 32B model is affordable — typical coding sessions cost less than $0.01.

> **Tip:** You can also place your `.env` in `~/.qwen-qode/.env` for a global key that works across all projects.

### 3. Build

```bash
npm run build
```

### 4. Launch the web UI

```bash
npm run web
```

This starts both the backend (port 3579) and the Next.js UI (port 3000). Open **http://localhost:3000**, browse to your project folder, and start chatting.

---

## CLI usage

Qwen Qode also ships as a `qq` CLI for terminal use.

```bash
# Install globally
npm link

# Interactive mode — opens a REPL in your project
qq -p /path/to/your/project

# Single-shot mode — great for scripting
qq -p . -m "List all API routes in this project"
qq -p . -m "Add a loading spinner to the login button"

# Start the web server only
qq --web
```

### REPL commands

| Command | Description |
|---|---|
| `/clear` | Clear conversation history |
| `/cd <path>` | Change to a different project directory |
| `/history` | Show number of messages in context |
| `/exit` | Quit |

---

## Available tools

| Tool | Description |
|---|---|
| `read_file` | Read a file with line numbers, optionally a specific range |
| `write_file` | Write or overwrite a file (creates parent dirs automatically) |
| `edit_file` | Replace an exact string in a file — safer than full rewrites |
| `list_files` | Recursive directory listing, depth-limited, ignores build artifacts |
| `bash` | Run a shell command in the project directory |
| `glob_search` | Find files by name pattern or grep file contents by regex |

---

## Project structure

```
qwen-qode/
├── src/
│   ├── agent.ts        # ReAct agent loop — parses tool calls, manages conversation
│   ├── config.ts       # API key + model config, reads from .env
│   ├── server.ts       # HTTP server with SSE streaming (port 3579)
│   ├── index.ts        # CLI entry point (qq command + --web flag)
│   ├── ui.ts           # Terminal colour rendering
│   └── tools/
│       ├── read_file.ts
│       ├── write_file.ts
│       ├── edit_file.ts
│       ├── list_files.ts
│       ├── bash.ts
│       └── glob_search.ts
└── web/                # Next.js browser UI
    └── app/
        ├── page.tsx
        └── components/
            ├── ProjectPicker.tsx   # Clickable folder browser
            ├── ChatInterface.tsx   # Streaming chat with tool call display
            ├── MessageBubble.tsx   # Message renderer (markdown-lite)
            └── ToolCallBlock.tsx   # Collapsible tool call/result blocks
```

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | — | **Required.** Your OpenRouter API key |
| `QWEN_MODEL` | `qwen/qwen-2.5-coder-32b-instruct` | Any OpenRouter model slug |

You can swap `QWEN_MODEL` for any other model on OpenRouter — the agent loop works with any model that can follow structured output instructions.

---

## Switching models

Because Qwen Qode uses plain-text tool calling rather than a provider API feature, **any model on OpenRouter works**. Just update `.env`:

```env
# Smaller / faster Qwen model
QWEN_MODEL=qwen/qwen-2.5-coder-7b-instruct

# Or a different provider entirely
QWEN_MODEL=google/gemini-flash-1.5
QWEN_MODEL=mistralai/mistral-small
```

---

## Contributing

Contributions are welcome. Some ideas for what to add:

- **Streaming text** — stream tokens as they arrive rather than buffering the full response
- **Image support** — pass screenshots to vision-capable models
- **Multiple sessions** — sidebar with open project tabs
- **File diff view** — show before/after when files are edited
- **Custom system prompt** — per-project `.qqconfig` file

Please open an issue before starting large changes.

---

## License

MIT — see [LICENSE](LICENSE).

---

## Acknowledgements

Built with [Qwen2.5-coder](https://github.com/QwenLM/Qwen2.5-Coder) by Alibaba Cloud, served via [OpenRouter](https://openrouter.ai), UI built with [Next.js](https://nextjs.org).
