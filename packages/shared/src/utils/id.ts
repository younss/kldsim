/**
 * Works in both Node (>=19) and browsers without importing "node:crypto",
 * so this package stays isomorphic between apps/api and apps/web.
 */
export function generateId(): string {
  return globalThis.crypto.randomUUID();
}
