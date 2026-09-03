/**
 * Mark any element as a right-click scope:
 *
 *   <div {...ctxProps("token-row", token.address, token)}>…</div>
 *
 * Modules contribute items for the scope via `contextMenus: [{ scope: "token-row", items }]`.
 * Nested scopes stack (innermost first) and the global "*" items always append.
 */
const store = new Map<string, unknown>();
const MAX = 5000;

function key(scope: string, id: string) {
  return `${scope}::${id}`;
}

export function ctxProps<T>(scope: string, id: string, data?: T): { "data-ctx": string; "data-ctx-id": string } {
  if (data !== undefined) {
    const k = key(scope, id);
    if (!store.has(k) && store.size >= MAX) {
      const first = store.keys().next().value;
      if (first !== undefined) store.delete(first);
    }
    store.set(k, data);
  }
  return { "data-ctx": scope, "data-ctx-id": id };
}

export function getCtxData<T = unknown>(scope: string, id: string): T | undefined {
  return store.get(key(scope, id)) as T | undefined;
}

export function clearCtxData(scope: string, id: string) {
  store.delete(key(scope, id));
}
