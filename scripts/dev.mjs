/**
 * Starts the backend server and the Next.js dev UI in parallel.
 * Replaces the `concurrently` package (transitive shell-quote CVE).
 *
 * Both children are launched with `process.execPath` — the real Node binary
 * running this script — rather than `npm`/`next` shell shims.
 *
 * We also strip Node's permission-model flags from NODE_OPTIONS before handing
 * the env to the children. Socket Firewall (the `socket npm` wrapper) enforces
 * its sandbox by setting `NODE_OPTIONS=--permission --allow-*`, which every
 * descendant inherits. Next.js re-spawns a dev worker and filters NODE_OPTIONS
 * in a way that keeps `--allow-*` but drops `--permission`, so the worker
 * crashes with `ERR_MISSING_OPTION: --permission is required`. Removing the
 * permission flags from the child env avoids that mismatch entirely.
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const NODE = process.execPath;

const nextBin = join(ROOT, "web", "node_modules", "next", "dist", "bin", "next");
if (!existsSync(nextBin)) {
  console.error("Next.js is not installed. Run:  cd web && npm install");
  process.exit(1);
}

/** Remove --permission / --allow-* flags (Socket Firewall sandbox) from NODE_OPTIONS. */
function childEnv() {
  const env = { ...process.env };
  if (env.NODE_OPTIONS) {
    const cleaned = env.NODE_OPTIONS.split(/\s+/)
      .filter((opt) => opt && !opt.startsWith("--permission") && !opt.startsWith("--allow-"))
      .join(" ")
      .trim();
    if (cleaned) env.NODE_OPTIONS = cleaned;
    else delete env.NODE_OPTIONS;
  }
  return env;
}

function run(label, args, cwd) {
  const child = spawn(NODE, args, { cwd, stdio: "inherit", env: childEnv() });
  child.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(`[${label}] exited with code ${code}`);
      stop();
      process.exit(code);
    }
  });
  return child;
}

const server = run("server", [join(ROOT, "dist", "index.js"), "--web"], ROOT);
const ui = run("ui", [nextBin, "dev"], join(ROOT, "web"));

function stop() {
  server.kill();
  ui.kill();
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
