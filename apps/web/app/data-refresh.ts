/**
 * Cross-page refresh when server-backed data changes (e.g. finance approval).
 * Listeners refetch from the database via API.
 */
export const DATA_REFRESH_EVENT = "cresos:data-refresh";

export function emitDataRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DATA_REFRESH_EVENT));
}

export function subscribeDataRefresh(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const fn = () => handler();
  window.addEventListener(DATA_REFRESH_EVENT, fn);
  return () => window.removeEventListener(DATA_REFRESH_EVENT, fn);
}
