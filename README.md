# Qwen Qode

A local AI coding agent powered by [Qwen2.5-coder](https://huggingface.co/Qwen/Qwen2.5-Coder-32B-Instruct). Open any project folder and chat with an agent that can read files, write code, run shell commands, and search your codebase — all through a clean browser UI or a terminal CLI.

Runs on [OpenRouter](https://openrouter.ai) (cloud, no GPU needed) or fully offline via [Ollama](https://ollama.com) / [LM Studio](https://lmstudio.ai).

---

## Features

- **Browser UI** — dark-themed chat interface with streaming responses
- **Collapsible tool calls** — see exactly which files were read or commands run
- **Folder browser** — click through your filesystem to open any project
- **Terminal CLI** — `qq` command for scripting and headless use
- **6 built-in tools** — read, write, edit, list, bash, and search
- **Cloud or local** — use OpenRouter with no setup, or run fully offline via Ollama / LM Studio
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
  ┌─ Call Qwen2.5-coder (OpenRouter or local server)
  ├─ Parse tool call from response (JSON in <tool_call> tags or raw JSON)
  ├─ Execute tool against the selected project folder
  ├─ Inject result back as context
  └─ Repeat until final answer
```

The agent uses a **ReAct-style prompting** approach — no native function-calling API required. The model emits structured JSON, we parse it, execute the tool, and feed the result back as a user message. This works reliably with Qwen2.5-coder-32B and requires no special provider support.

---

## Prerequisites

- **Node.js** ≥ 18 (tested on v22)
- **One of:**
  - An [OpenRouter](https://openrouter.ai) API key (free tier works) — easiest to get started
  - [Ollama](https://ollama.com) or [LM Studio](https://lmstudio.ai) running locally — no API key needed, works offline

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/baberparweez/qwen-qode.git
cd qwen-qode
npm install
cd web && npm install && cd ..
```

### 2. Configure your model provider

```bash
cp .env.example .env
```

**Option A — OpenRouter (cloud, no GPU needed):**

```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
QWEN_MODEL=qwen/qwen-2.5-coder-32b-instruct
```

Get a free API key at [openrouter.ai/keys](https://openrouter.ai/keys). Typical coding sessions cost less than $0.01.

**Option B — Ollama or LM Studio (offline, no API key):**

See [Running fully offline with a local model](#running-fully-offline-with-a-local-model) below.

> **Tip:** Place your `.env` in `~/.qwen-qode/.env` to share it across all projects.

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

## Running fully offline with a local model

Qwen Qode works with any OpenAI-compatible local model server — no code changes needed, just update `.env`.

### Option A — Ollama (recommended)

[Ollama](https://ollama.com) is the simplest way to run Qwen2.5-coder locally on Mac, Linux, or Windows.

```bash
# Install Ollama (macOS)
brew install ollama

# Pull the model — choose a size that fits your RAM:
ollama pull qwen2.5-coder:7b    # ~4 GB  — works on 8 GB RAM
ollama pull qwen2.5-coder:14b   # ~8 GB  — good quality, 16 GB RAM
ollama pull qwen2.5-coder:32b   # ~20 GB — best quality, 32 GB RAM
```

Then update your `.env`:

```env
QQ_BASE_URL=http://localhost:11434/v1
QWEN_MODEL=qwen2.5-coder:32b
# No API key needed
```

Start the Ollama server before launching Qwen Qode:

```bash
ollama serve
```

If you installed the [Ollama desktop app](https://ollama.com/download) instead of brew, it starts automatically from the menu bar.

### Option B — LM Studio

[LM Studio](https://lmstudio.ai) has a GUI for downloading and running models.

1. Download LM Studio and search for **Qwen2.5-Coder** in the model browser
2. Load a model and start the local server (default port 1234)
3. Update `.env`:

```env
QQ_BASE_URL=http://localhost:1234/v1
QQ_API_KEY=lm-studio
QWEN_MODEL=qwen2.5-coder-32b-instruct
```

### Model size guide

| Model | RAM needed | Quality |
|---|---|---|
| `qwen2.5-coder:3b` | ~2 GB | Basic — fast, limited reasoning |
| `qwen2.5-coder:7b` | ~5 GB | Good — solid for most tasks |
| `qwen2.5-coder:14b` | ~9 GB | Better — recommended minimum |
| `qwen2.5-coder:32b` | ~20 GB | Best — matches cloud quality |

> Apple Silicon Macs run these efficiently via Metal GPU acceleration. A 14B model on an M2/M3 MacBook Pro is fast and capable.

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
| `OPENROUTER_API_KEY` | — | Required for cloud mode. Get one at [openrouter.ai/keys](https://openrouter.ai/keys) |
| `QQ_BASE_URL` | `https://openrouter.ai/api/v1` | Override to point at a local server (Ollama, LM Studio) |
| `QQ_API_KEY` | — | Generic key override. Not needed for local servers |
| `QWEN_MODEL` | `qwen/qwen-2.5-coder-32b-instruct` | Model slug — format depends on your provider |

The agent loop works with any model that can follow structured output instructions — cloud or local.

---

## Switching models

Because Qwen Qode uses plain-text tool calling rather than a provider-specific API feature, **any model works** — cloud or local. Just update `.env`:

```env
# Smaller / faster Qwen via OpenRouter
QWEN_MODEL=qwen/qwen-2.5-coder-7b-instruct

# Different cloud model entirely
QWEN_MODEL=google/gemini-flash-1.5

# Local model via Ollama
QQ_BASE_URL=http://localhost:11434/v1
QWEN_MODEL=qwen2.5-coder:14b
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

Built with [Qwen2.5-coder](https://github.com/QwenLM/Qwen2.5-Coder) by Alibaba Cloud. Cloud inference via [OpenRouter](https://openrouter.ai). Local inference via [Ollama](https://ollama.com) or [LM Studio](https://lmstudio.ai). UI built with [Next.js](https://nextjs.org).
