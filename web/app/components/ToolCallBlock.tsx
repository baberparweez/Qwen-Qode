"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight, Terminal, CheckCircle, XCircle } from "lucide-react";
import type { ToolCallPair } from "./types";

const TOOL_ICONS: Record<string, string> = {
  read_file: "📄",
  write_file: "💾",
  edit_file: "✏️",
  list_files: "📁",
  bash: "⚡",
  glob_search: "🔍",
};

export function ToolCallBlock({ pair }: { pair: ToolCallPair }) {
  const [open, setOpen] = useState(false);
  const { call, result } = pair;
  const icon = TOOL_ICONS[call.name] ?? "🔧";
  const pending = !result;

  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        marginTop: 8,
        overflow: "hidden",
        fontSize: 13,
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--text-muted)",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 15 }}>{icon}</span>
        <span style={{ fontFamily: "monospace", color: "var(--accent)", fontWeight: 600 }}>
          {call.name}
        </span>

        {/* primary arg preview */}
        <span style={{ color: "var(--text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {call.args.path
            ? String(call.args.path)
            : call.args.command
            ? String(call.args.command).slice(0, 60)
            : ""}
        </span>

        {pending ? (
          <span style={{ fontSize: 11, color: "var(--yellow)" }}>running…</span>
        ) : result!.success ? (
          <CheckCircle size={14} color="var(--green)" />
        ) : (
          <XCircle size={14} color="var(--red)" />
        )}

        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "10px 12px" }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Input
            </span>
            <pre
              style={{
                marginTop: 4,
                background: "var(--surface)",
                padding: "8px 10px",
                borderRadius: 6,
                color: "var(--text)",
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {JSON.stringify(call.args, null, 2)}
            </pre>
          </div>

          {result && (
            <div>
              <span style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Output
              </span>
              <pre
                style={{
                  marginTop: 4,
                  background: "var(--surface)",
                  padding: "8px 10px",
                  borderRadius: 6,
                  color: result.success ? "var(--text)" : "var(--red)",
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  maxHeight: 300,
                  overflowY: "auto",
                }}
              >
                {result.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
