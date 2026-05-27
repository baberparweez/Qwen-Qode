"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Trash2, FolderOpen, X } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import type { ChatMessage, Session, AgentEvent, ToolCallPair } from "./types";

const API = "http://localhost:3579";

interface Props {
  session: Session;
  onClose: () => void;
}

export function ChatInterface({ session, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");
    setTimeout(autoResize, 0);
    setStreaming(true);

    setMessages((prev) => [...prev, { role: "user", content: text }]);

    // Placeholder assistant message we'll build up
    const assistantIndex = messages.length + 1; // after user message
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", toolCalls: [] },
    ]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const resp = await fetch(`${API}/api/sessions/${session.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
        signal: ctrl.signal,
      });

      if (!resp.ok || !resp.body) {
        throw new Error(`Server error: ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Local mutable state for the streaming assistant message
      let assistantText = "";
      let toolCalls: ToolCallPair[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event: AgentEvent;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          if (event.type === "text") {
            assistantText += event.content;
          } else if (event.type === "tool_call") {
            toolCalls = [...toolCalls, { call: { name: event.name, args: event.args } }];
          } else if (event.type === "tool_result") {
            // Attach result to the last matching pending tool call
            toolCalls = toolCalls.map((tc, i) => {
              if (i === toolCalls.length - 1 && !tc.result) {
                return { ...tc, result: { success: event.success, output: event.output } };
              }
              return tc;
            });
          } else if (event.type === "error") {
            assistantText += `\n\n[Error: ${event.message}]`;
          }

          // Patch the assistant message in place
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = {
              role: "assistant",
              content: assistantText,
              toolCalls: [...toolCalls],
            };
            return next;
          });
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return;
      setMessages((prev) => [
        ...prev,
        { role: "error", content: String(err) },
      ]);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, streaming, messages.length, session.id]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  async function clearHistory() {
    await fetch(`${API}/api/sessions/${session.id}/clear`, { method: "POST" });
    setMessages([]);
  }

  const shortPath = session.projectPath.replace(/^\/Users\/[^/]+/, "~");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div
        style={{
          borderBottom: "1px solid var(--border)",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "var(--surface)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontWeight: 900,
            fontFamily: "monospace",
            fontSize: 18,
            background: "linear-gradient(135deg, #6ee7f7, #a78bfa)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          QQ
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <FolderOpen size={13} color="var(--text-muted)" />
            <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-muted)" }}>
              {shortPath}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
            {session.model}
          </div>
        </div>

        <button
          onClick={clearHistory}
          title="Clear history"
          style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 6, borderRadius: 6 }}
        >
          <Trash2 size={15} />
        </button>
        <button
          onClick={onClose}
          title="Change project"
          style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 6, borderRadius: 6 }}
        >
          <X size={15} />
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 8px" }}>
        {messages.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--text-muted)",
              gap: 12,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 36 }}>⚡</div>
            <div style={{ fontWeight: 600, color: "var(--text)" }}>Ready to code</div>
            <div style={{ fontSize: 13, maxWidth: 380 }}>
              Ask Qwen Qode anything about your project — read files, write code, run commands.
            </div>
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                "List all files in this project",
                "Explain what this codebase does",
                "Find all TODO comments",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "8px 16px",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {streaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", color: "var(--text-muted)", marginBottom: 16 }}>
            <Loader2 size={14} className="animate-spin" />
            <span style={{ fontSize: 13 }}>Thinking…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          padding: "16px 20px",
          background: "var(--surface)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-end",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "8px 12px",
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize(); }}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your code…  (Enter to send, Shift+Enter for newline)"
            rows={1}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text)",
              fontSize: 14,
              lineHeight: 1.6,
              resize: "none",
              fontFamily: "inherit",
              maxHeight: 200,
              overflowY: "auto",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || streaming}
            style={{
              background: input.trim() && !streaming ? "var(--accent)" : "var(--surface)",
              border: "none",
              borderRadius: 8,
              padding: "6px 10px",
              cursor: input.trim() && !streaming ? "pointer" : "not-allowed",
              color: input.trim() && !streaming ? "#0d0d0d" : "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s",
              flexShrink: 0,
            }}
          >
            {streaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 8, textAlign: "center" }}>
          Powered by {session.model} via OpenRouter
        </div>
      </div>
    </div>
  );
}
