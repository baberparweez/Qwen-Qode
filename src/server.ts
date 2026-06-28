import http from "http";
import { parse as parseUrl } from "url";
import { existsSync, statSync, readdirSync } from "fs";
import { resolve, join } from "path";
import { assertApiKey, MODEL, MODELS } from "./config.js";
import { Agent, type AgentEvent } from "./agent.js";
import { getStore } from "./rag/registry.js";
import { indexProject } from "./rag/indexer.js";

const PORT = 3579;
const HOME = process.env.HOME ?? "/";

const sessions = new Map<string, Agent>();

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function expandPath(p: string): string {
  if (p.startsWith("~/")) return join(HOME, p.slice(2));
  if (p === "~") return HOME;
  return p;
}

function json(res: http.ServerResponse, status: number, data: unknown) {
  const body = JSON.stringify(data);
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(body);
}

function cors(res: http.ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

const IGNORED = new Set([".git", "node_modules", ".DS_Store", "dist", "build", ".next"]);

async function handler(req: http.IncomingMessage, res: http.ServerResponse) {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const parsed = parseUrl(req.url ?? "/", true);
  const pathname = parsed.pathname ?? "/";

  // GET /api/models — list available models
  if (req.method === "GET" && pathname === "/api/models") {
    return json(res, 200, MODELS);
  }

  // GET /api/browse?path=...
  if (req.method === "GET" && pathname === "/api/browse") {
    const raw = String(parsed.query.path ?? HOME);
    const dir = resolve(expandPath(raw));
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      return json(res, 400, { error: "Not a directory" });
    }
    let entries: string[];
    try { entries = readdirSync(dir); }
    catch { return json(res, 403, { error: "Permission denied" }); }
    const dirs = entries
      .filter((e) => !IGNORED.has(e) && !e.startsWith("."))
      .filter((e) => { try { return statSync(join(dir, e)).isDirectory(); } catch { return false; } })
      .sort();
    const parent = dir !== "/" ? resolve(dir, "..") : null;
    return json(res, 200, { path: dir, parent, dirs });
  }

  // POST /api/sessions
  if (req.method === "POST" && pathname === "/api/sessions") {
    const body = (await readBody(req)) as { projectPath?: string; model?: string };
    const projectPath = resolve(expandPath(body.projectPath ?? HOME));
    if (!existsSync(projectPath) || !statSync(projectPath).isDirectory()) {
      return json(res, 400, { error: "Invalid project path" });
    }
    const id = makeId();
    const model = body.model ?? MODEL;
    sessions.set(id, new Agent(projectPath, model));
    return json(res, 200, { sessionId: id, projectPath, model });
  }

  // POST /api/sessions/:id/model — switch model for an existing session
  if (req.method === "POST" && pathname?.match(/^\/api\/sessions\/[^/]+\/model$/)) {
    const id = pathname.split("/")[3];
    const agent = sessions.get(id);
    if (!agent) return json(res, 404, { error: "Session not found" });
    const body = (await readBody(req)) as { model?: string };
    if (!body.model) return json(res, 400, { error: "model is required" });
    agent.setModel(body.model);
    return json(res, 200, { model: body.model });
  }

  // DELETE /api/sessions/:id
  if (req.method === "DELETE" && pathname?.startsWith("/api/sessions/")) {
    const id = pathname.split("/")[3];
    sessions.delete(id);
    return json(res, 200, { ok: true });
  }

  // POST /api/sessions/:id/clear
  if (req.method === "POST" && pathname?.match(/^\/api\/sessions\/[^/]+\/clear$/)) {
    const id = pathname.split("/")[3];
    const agent = sessions.get(id);
    if (!agent) return json(res, 404, { error: "Session not found" });
    agent.clearHistory();
    return json(res, 200, { ok: true });
  }

  // POST /api/sessions/:id/chat — SSE streaming
  if (req.method === "POST" && pathname?.match(/^\/api\/sessions\/[^/]+\/chat$/)) {
    const id = pathname.split("/")[3];
    const agent = sessions.get(id);
    if (!agent) return json(res, 404, { error: "Session not found" });

    const body = (await readBody(req)) as { message?: string; images?: string[] };
    if (!body.message?.trim()) return json(res, 400, { error: "message is required" });

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const send = (event: AgentEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      await agent.run(body.message, send, body.images);
    } catch (e) {
      send({ type: "error", message: String(e) });
    }
    res.end();
    return;
  }

  // POST /api/sessions/:id/index — build/update semantic search index
  if (req.method === "POST" && pathname?.match(/^\/api\/sessions\/[^/]+\/index$/)) {
    const id = pathname.split("/")[3];
    const agent = sessions.get(id);
    if (!agent) return json(res, 404, { error: "Session not found" });

    const cwd = agent.getCwd();
    const store = getStore(cwd);

    try {
      const result = indexProject(cwd, store);
      return json(res, 200, result);
    } catch (e) {
      return json(res, 500, { error: String(e) });
    }
  }

  // GET /api/sessions/:id/index — check index status
  if (req.method === "GET" && pathname?.match(/^\/api\/sessions\/[^/]+\/index$/)) {
    const id = pathname.split("/")[3];
    const agent = sessions.get(id);
    if (!agent) return json(res, 404, { error: "Session not found" });
    const store = getStore(agent.getCwd());
    return json(res, 200, { chunks: store.size(), files: store.getFiles().length });
  }

  // GET /api/info
  if (req.method === "GET" && pathname === "/api/info") {
    return json(res, 200, { model: MODEL, sessions: sessions.size });
  }

  json(res, 404, { error: "Not found" });
}

export async function startServer() {
  assertApiKey();
  const server = http.createServer(handler);
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`\n  Qwen Qode server running at http://localhost:${PORT}`);
    console.log(`  Open the web UI at http://localhost:3000\n`);
  });
}
