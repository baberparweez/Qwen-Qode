/**
 * Recently-opened project paths, persisted in localStorage.
 * Frontend-only — no server involvement.
 */
const KEY = "qq-recent-projects";
const MAX = 8;

export function getRecentProjects(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function addRecentProject(path: string): void {
  if (typeof window === "undefined" || !path) return;
  try {
    const list = [path, ...getRecentProjects().filter((p) => p !== path)].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // localStorage unavailable (private mode etc.) — silently ignore
  }
}

export function removeRecentProject(path: string): void {
  if (typeof window === "undefined") return;
  try {
    const list = getRecentProjects().filter((p) => p !== path);
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}
