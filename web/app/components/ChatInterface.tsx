"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Trash2, X, Paperclip, AlertTriangle, ChevronDown, Database } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import type { ChatMessage, Session, AgentEvent, ToolCallPair, ModelOption } from "./types";

const API = "http://localhost:3579";

interface Props {
  session: Session;
  onClose: () => void;
}

export function ChatInterface({ session, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [currentModel, setCurrentModel] = useState(session.model);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [indexing, setIndexing] = useState(false);
  const [indexStatus, setIndexStatus] = useState<string | null>(null);
  const [showIndexHelp, setShowIndexHelp] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load available models
  useEffect(() => {
    fetch(`${API}/api/models`)
      .then((r) => r.json())
      .then(setModels)
      .catch(() => {});
  }, []);

  // Close model picker on outside click
  useEffect(() => {
    if (!showModelPicker) return;
    const handler = () => setShowModelPicker(false);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [showModelPicker]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle paste — capture images pasted from clipboard
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItems = items.filter((i) => i.type.startsWith("image/"));
      if (imageItems.length === 0) return;
      e.preventDefault();
      imageItems.forEach((item) => {
        const file = item.getAsFile();
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setPendingImages((prev) => [...prev, reader.result as string]);
        reader.readAsDataURL(file);
      });
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, []);

  const activeModel = models.find((m) => m.id === currentModel);
  const isVision = activeModel?.vision ?? false;

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  async function switchModel(modelId: string) {
    setCurrentModel(modelId);
    setShowModelPicker(false);
    await fetch(`${API}/api/sessions/${session.id}/model`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelId }),
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setPendingImages((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if ((!text && pendingImages.length === 0) || streaming) return;

    const imagesToSend = [...pendingImages];
    setInput("");
    setPendingImages([]);
    setTimeout(autoResize, 0);
    setStreaming(true);

    setMessages((prev) => [...prev, { role: "user", content: text, images: imagesToSend }]);
    setMessages((prev) => [...prev, { role: "assistant", content: "", toolCalls: [] }]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const resp = await fetch(`${API}/api/sessions/${session.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text || "Please analyse the attached image(s).", images: imagesToSend.length > 0 ? imagesToSend : undefined }),
        signal: ctrl.signal,
      });

      if (!resp.ok || !resp.body) throw new Error(`Server error: ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
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
          try { event = JSON.parse(line.slice(6)); } catch { continue; }

          if (event.type === "text") {
            assistantText += event.content;
          } else if (event.type === "tool_call") {
            toolCalls = [...toolCalls, { call: { name: event.name, args: event.args } }];
          } else if (event.type === "tool_result") {
            toolCalls = toolCalls.map((tc, i) =>
              i === toolCalls.length - 1 && !tc.result
                ? { ...tc, result: { success: event.success, output: event.output } }
                : tc
            );
          } else if (event.type === "error") {
            assistantText += `\n\n[Error: ${event.message}]`;
          }

          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: "assistant", content: assistantText, toolCalls: [...toolCalls] };
            return next;
          });
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return;
      setMessages((prev) => [...prev, { role: "error", content: String(err) }]);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, pendingImages, streaming, session.id]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  async function clearHistory() {
    await fetch(`${API}/api/sessions/${session.id}/clear`, { method: "POST" });
    setMessages([]);
  }

  async function indexProject() {
    if (indexing) return;
    setIndexing(true);
    setIndexStatus(null);
    try {
      const resp = await fetch(`${API}/api/sessions/${session.id}/index`, { method: "POST" });
      if (resp.ok) {
        const data = await resp.json() as { added: number; skipped: number; files: number };
        setIndexStatus(`Indexed ${data.files} files (${data.added} chunks)`);
      } else {
        setIndexStatus("Indexing failed");
      }
    } catch {
      setIndexStatus("Indexing failed");
    } finally {
      setIndexing(false);
      setTimeout(() => setIndexStatus(null), 5000);
    }
  }

  const shortPath = session.projectPath.replace(/^\/Users\/[^/]+/, "~");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--border)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, background: "var(--surface)", flexShrink: 0 }}>
        <div style={{ fontWeight: 900, fontFamily: "monospace", fontSize: 18, background: "linear-gradient(135deg, #6ee7f7, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          QQ
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {shortPath}
          </div>

          {/* Model switcher */}
          <div style={{ position: "relative", display: "inline-block" }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowModelPicker((v) => !v); }}
              style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: "2px 0", color: isVision ? "var(--yellow)" : "var(--accent)" }}
            >
              <span style={{ fontSize: 11, fontWeight: 600 }}>
                {isVision ? "📷 " : ""}{activeModel?.name ?? currentModel}
              </span>
              <ChevronDown size={11} />
            </button>

            {showModelPicker && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 6, zIndex: 50, minWidth: 280, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
              >
                {models.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => switchModel(m.id)}
                    style={{
                      display: "block", width: "100%", textAlign: "left", background: m.id === currentModel ? "var(--accent-dim)" : "transparent",
                      border: "none", borderRadius: 7, padding: "8px 10px", cursor: "pointer", marginBottom: 2,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, color: m.id === currentModel ? "var(--accent)" : "var(--text)", fontWeight: 600 }}>
                        {m.vision ? "📷 " : "⌨️ "}{m.name}
                      </span>
                      {m.id === currentModel && <span style={{ fontSize: 10, color: "var(--accent)", marginLeft: "auto" }}>active</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{m.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          style={{ position: "relative" }}
          onMouseEnter={() => setShowIndexHelp(true)}
          onMouseLeave={() => setShowIndexHelp(false)}
        >
          <button
            onClick={indexProject}
            disabled={indexing}
            aria-label="Index project for code search"
            style={{ background: "transparent", border: "none", cursor: indexing ? "not-allowed" : "pointer", color: indexStatus ? "var(--accent)" : "var(--text-muted)", padding: 6, borderRadius: 6, display: "flex", alignItems: "center" }}
          >
            {indexing ? <Loader2 size={15} className="animate-spin" /> : <Database size={15} />}
          </button>
          {indexStatus && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", whiteSpace: "nowrap", fontSize: 12, color: "var(--accent)", zIndex: 40, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
              {indexStatus}
            </div>
          )}
          {showIndexHelp && !indexStatus && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 260, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", fontSize: 12, lineHeight: 1.5, color: "var(--text-muted)", zIndex: 40, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
              <div style={{ color: "var(--text)", fontWeight: 600, marginBottom: 4 }}>
                {indexing ? "Indexing…" : "Index project for code search"}
              </div>
              Builds a searchable index of this project so the agent can find relevant code by keyword and concept — without reading every file. Saved to <code style={{ color: "var(--accent)" }}>.qq/index.json</code>. Re-run after big changes.
            </div>
          )}
        </div>

        <button onClick={clearHistory} title="Clear history" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 6, borderRadius: 6 }}>
          <Trash2 size={15} />
        </button>
        <button onClick={onClose} title="Change project" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 6, borderRadius: 6 }}>
          <X size={15} />
        </button>
      </div>

      {/* Vision warning banner */}
      {isVision && activeModel?.warning && (
        <div style={{ background: "#2a2000", borderBottom: "1px solid #5a4000", padding: "8px 16px", display: "flex", alignItems: "flex-start", gap: 8, flexShrink: 0 }}>
          <AlertTriangle size={14} color="var(--yellow)" style={{ marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "#f5d97a", lineHeight: 1.5 }}>
            <strong>Vision model active.</strong> {activeModel.warning}
          </span>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 8px" }}>
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", gap: 12, textAlign: "center" }}>
            <div style={{ fontSize: 36 }}>{isVision ? "📷" : "⚡"}</div>
            <div style={{ fontWeight: 600, color: "var(--text)" }}>Ready to code</div>
            <div style={{ fontSize: 13, maxWidth: 380 }}>
              {isVision
                ? "Vision model active — you can attach screenshots or diagrams alongside your message."
                : "Ask Qwen Qode anything about your project — read files, write code, run commands."}
            </div>
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {(isVision
                ? ["Attach a screenshot and describe the bug", "Share a UI mockup and generate the component", "List all files in this project"]
                : ["List all files in this project", "Explain what this codebase does", "Find all TODO comments"]
              ).map((s) => (
                <button key={s} onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 16px", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}

        {streaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", color: "var(--text-muted)", marginBottom: 16 }}>
            <Loader2 size={14} className="animate-spin" />
            <span style={{ fontSize: 13 }}>Thinking…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px", background: "var(--surface)", flexShrink: 0 }}>

        {/* Image previews */}
        {pendingImages.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {pendingImages.map((src, i) => (
              <div key={i} style={{ position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
                <button
                  onClick={() => setPendingImages((prev) => prev.filter((_, j) => j !== i))}
                  style={{ position: "absolute", top: -6, right: -6, background: "var(--red)", border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, padding: "8px 10px" }}>
          {/* Attach button — only shown for vision models */}
          {isVision && (
            <>
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} style={{ display: "none" }} />
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Attach image"
                style={{ background: "transparent", border: "none", cursor: "pointer", color: pendingImages.length > 0 ? "var(--accent)" : "var(--text-muted)", padding: "4px 2px", flexShrink: 0, display: "flex", alignItems: "center" }}
              >
                <Paperclip size={16} />
              </button>
            </>
          )}

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize(); }}
            onKeyDown={handleKeyDown}
            placeholder={isVision ? "Ask anything or attach an image…  (⌘V to paste)" : "Ask anything about your code…  (Enter to send)"}
            rows={1}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 14, lineHeight: 1.6, resize: "none", fontFamily: "inherit", maxHeight: 200, overflowY: "auto" }}
          />

          <button
            onClick={sendMessage}
            disabled={(!input.trim() && pendingImages.length === 0) || streaming}
            style={{
              background: (input.trim() || pendingImages.length > 0) && !streaming ? "var(--accent)" : "var(--surface)",
              border: "none", borderRadius: 8, padding: "6px 10px",
              cursor: (input.trim() || pendingImages.length > 0) && !streaming ? "pointer" : "not-allowed",
              color: (input.trim() || pendingImages.length > 0) && !streaming ? "#0d0d0d" : "var(--text-muted)",
              display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s", flexShrink: 0,
            }}
          >
            {streaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>

        <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 6, textAlign: "center" }}>
          {isVision ? "📷 Vision mode — you can paste or attach images" : `Powered by ${currentModel} via OpenRouter`}
        </div>
      </div>
    </div>
  );
}
