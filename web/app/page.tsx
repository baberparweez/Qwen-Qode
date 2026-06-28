"use client";
import { useState } from "react";
import { ProjectPicker } from "./components/ProjectPicker";
import { ChatInterface } from "./components/ChatInterface";
import { addRecentProject } from "./components/recents";
import type { Session } from "./components/types";

const API = "http://localhost:3579";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);

  async function startSession(projectPath: string) {
    const res = await fetch(`${API}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Server unreachable" }));
      throw new Error(err.error ?? `Server error ${res.status}`);
    }
    const data = await res.json();
    addRecentProject(data.projectPath);
    setSession({ id: data.sessionId, projectPath: data.projectPath, model: data.model });
  }

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
      {session ? (
        <ChatInterface session={session} onClose={() => setSession(null)} />
      ) : (
        <ProjectPicker onStart={startSession} />
      )}
    </div>
  );
}
