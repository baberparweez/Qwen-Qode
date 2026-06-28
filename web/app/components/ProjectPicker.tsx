"use client";
import { useState, useEffect } from "react";
import { ChevronRight, Folder, FolderOpen, ArrowLeft, ArrowRight, Loader2, Home, Clock, X } from "lucide-react";
import { getRecentProjects, removeRecentProject } from "./recents";

const API = "http://localhost:3579";

interface DirListing {
  path: string;
  parent: string | null;
  dirs: string[];
}

interface Props {
  onStart: (projectPath: string) => Promise<void>;
}

export function ProjectPicker({ onStart }: Props) {
  const [listing, setListing] = useState<DirListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [serverDown, setServerDown] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => { setRecents(getRecentProjects()); }, []);

  async function browse(path?: string) {
    setLoading(true);
    setError("");
    try {
      const url = `${API}/api/browse${path ? `?path=${encodeURIComponent(path)}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? "Failed to load directory");
        return;
      }
      setListing(await res.json());
      setServerDown(false);
    } catch {
      setServerDown(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { browse(); }, []);

  async function handleSelect(path: string) {
    setStarting(true);
    setError("");
    try {
      await onStart(path);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setStarting(false);
    }
  }

  const shortPath = (p: string) => p.replace(/^\/Users\/[^/]+/, "~");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 28,
        padding: 24,
      }}
    >
      {/* Logo */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: 52,
            fontWeight: 900,
            fontFamily: "monospace",
            background: "linear-gradient(135deg, #6ee7f7, #a78bfa)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-3px",
          }}
        >
          QQ
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
          Qwen Qode — coding agent
        </div>
      </div>

      {/* Recent projects */}
      {!serverDown && recents.length > 0 && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            width: "100%",
            maxWidth: 520,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
            <Clock size={14} color="var(--text-muted)" />
            <span style={{ fontWeight: 600, fontSize: 13 }}>Recent projects</span>
          </div>
          <div style={{ maxHeight: 180, overflowY: "auto" }}>
            {recents.map((p) => (
              <div key={p} style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
                <button
                  onClick={() => handleSelect(p)}
                  disabled={starting}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
                    background: "transparent", border: "none", cursor: starting ? "default" : "pointer",
                    color: "var(--text)", textAlign: "left", fontFamily: "monospace", fontSize: 12,
                    overflow: "hidden",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--surface-2)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                >
                  <FolderOpen size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {shortPath(p)}
                  </span>
                </button>
                <button
                  onClick={() => { removeRecentProject(p); setRecents(getRecentProjects()); }}
                  title="Remove from recents"
                  style={{
                    background: "transparent", border: "none", borderLeft: "1px solid var(--border)",
                    padding: "10px 12px", cursor: "pointer", color: "var(--text-muted)", display: "flex",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--red)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Browser card */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          width: "100%",
          maxWidth: 520,
          overflow: "hidden",
        }}
      >
        {/* Card header */}
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <FolderOpen size={16} color="var(--accent)" />
          <span style={{ fontWeight: 600, flex: 1 }}>Choose a project folder</span>
          {listing && (
            <button
              onClick={() => browse()}
              title="Go to home"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                padding: 4,
                borderRadius: 6,
                display: "flex",
              }}
            >
              <Home size={14} />
            </button>
          )}
        </div>

        {/* Breadcrumb */}
        {listing && (
          <div
            style={{
              padding: "8px 16px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "var(--surface-2)",
            }}
          >
            {listing.parent && (
              <button
                onClick={() => browse(listing.parent!)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: "2px 4px",
                  borderRadius: 4,
                  display: "flex",
                }}
              >
                <ArrowLeft size={13} />
              </button>
            )}
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 12,
                color: "var(--text-muted)",
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {shortPath(listing.path)}
            </span>
            <button
              onClick={() => handleSelect(listing!.path)}
              disabled={starting}
              title="Open this folder"
              style={{
                background: "var(--accent)",
                border: "none",
                cursor: "pointer",
                color: "#0d0d0d",
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {starting ? <Loader2 size={12} className="animate-spin" /> : <>Open <ArrowRight size={12} /></>}
            </button>
          </div>
        )}

        {/* Directory list */}
        <div style={{ minHeight: 200, maxHeight: 340, overflowY: "auto" }}>
          {serverDown ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>⚡</div>
              <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
                Server not running
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                Start the backend first:
                <br />
                <code
                  style={{
                    background: "var(--surface-2)",
                    padding: "2px 6px",
                    borderRadius: 4,
                    color: "var(--accent)",
                    marginTop: 6,
                    display: "inline-block",
                  }}
                >
                  npm run web:server
                </code>
              </div>
              <button
                onClick={() => browse()}
                style={{
                  marginTop: 16,
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "6px 14px",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Retry
              </button>
            </div>
          ) : loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
              <Loader2 size={20} color="var(--text-muted)" className="animate-spin" />
            </div>
          ) : listing && listing.dirs.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              No subdirectories — use the Open button above to select this folder
            </div>
          ) : (
            listing?.dirs.map((dir) => {
              const fullPath = `${listing.path}/${dir}`;
              return (
                <div
                  key={dir}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {/* Click name to drill in */}
                  <button
                    onClick={() => browse(fullPath)}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "11px 16px",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text)",
                      textAlign: "left",
                      fontSize: 14,
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--surface-2)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                  >
                    <Folder size={15} color="var(--accent)" style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {dir}
                    </span>
                    <ChevronRight size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  </button>

                  {/* Open this folder directly */}
                  <button
                    onClick={() => handleSelect(fullPath)}
                    disabled={starting}
                    title={`Open ${dir}`}
                    style={{
                      background: "transparent",
                      border: "none",
                      borderLeft: "1px solid var(--border)",
                      padding: "11px 14px",
                      cursor: "pointer",
                      color: "var(--text-muted)",
                      fontSize: 11,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "var(--accent-dim)";
                      (e.currentTarget as HTMLElement).style.color = "var(--accent)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                    }}
                  >
                    Open
                  </button>
                </div>
              );
            })
          )}
        </div>

        {error && (
          <div
            style={{
              padding: "10px 16px",
              borderTop: "1px solid var(--border)",
              color: "var(--red)",
              fontSize: 12,
              background: "#2a0d0d",
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
