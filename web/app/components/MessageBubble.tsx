"use client";
import { ToolCallBlock } from "./ToolCallBlock";
import type { ChatMessage } from "./types";

function renderText(text: string) {
  // Very light markdown: fenced code blocks and inline code
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```")) {
      const newline = part.indexOf("\n");
      const lang = newline > 3 ? part.slice(3, newline).trim() : "";
      const code = newline > 0 ? part.slice(newline + 1, -3) : part.slice(3, -3);
      return (
        <pre
          key={i}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "12px 14px",
            overflowX: "auto",
            margin: "10px 0",
            whiteSpace: "pre",
          }}
        >
          {lang && (
            <span style={{ display: "block", color: "var(--text-muted)", fontSize: 11, marginBottom: 6 }}>
              {lang}
            </span>
          )}
          <code style={{ color: "var(--accent)" }}>{code}</code>
        </pre>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          style={{
            background: "var(--surface-2)",
            padding: "1px 5px",
            borderRadius: 4,
            color: "var(--accent)",
            fontFamily: "monospace",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    // Plain text: split on newlines
    return part.split("\n").map((line, j, arr) => (
      <span key={`${i}-${j}`}>
        {line}
        {j < arr.length - 1 && <br />}
      </span>
    ));
  });
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <div
          style={{
            background: "var(--accent-dim)",
            border: "1px solid var(--accent)",
            borderRadius: "16px 16px 4px 16px",
            padding: "10px 16px",
            maxWidth: "75%",
            color: "var(--text)",
            lineHeight: 1.6,
          }}
        >
          {/* Attached images */}
          {message.role === "user" && message.images && message.images.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: message.content ? 8 : 0 }}>
              {message.images.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="" style={{ maxWidth: 200, maxHeight: 160, borderRadius: 8, objectFit: "cover", border: "1px solid var(--border)" }} />
              ))}
            </div>
          )}
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === "error") {
    return (
      <div
        style={{
          background: "#2a0d0d",
          border: "1px solid var(--red)",
          borderRadius: 10,
          padding: "10px 14px",
          color: "var(--red)",
          marginBottom: 20,
          fontSize: 13,
        }}
      >
        {message.content}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          fontSize: 11,
          color: "var(--accent)",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        Qwen Qode
      </div>

      {message.toolCalls && message.toolCalls.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {message.toolCalls.map((pair, i) => (
            <ToolCallBlock key={i} pair={pair} />
          ))}
        </div>
      )}

      {message.content && (
        <div
          style={{
            color: "var(--text)",
            lineHeight: 1.7,
          }}
        >
          {renderText(message.content)}
        </div>
      )}
    </div>
  );
}
