/**
 * Singleton registry of Store instances keyed by project path.
 * Shared between the semantic_search tool and the /index server endpoint
 * so that indexing via the UI is immediately visible to the agent.
 */
import { Store } from "./store.js";

const _stores = new Map<string, Store>();

export function getStore(projectPath: string): Store {
  let store = _stores.get(projectPath);
  if (!store) {
    store = new Store(projectPath);
    _stores.set(projectPath, store);
  }
  return store;
}

/** Reload the store from disk (call after an external index write). */
export function reloadStore(projectPath: string): Store {
  const store = new Store(projectPath);
  _stores.set(projectPath, store);
  return store;
}
