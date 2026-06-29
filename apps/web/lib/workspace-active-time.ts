const KEY_START = "cresos_ws_active_start";
const KEY_ACCUM = "cresos_ws_active_accum_sec";
const KEY_LAST_TICK = "cresos_ws_active_last_tick";
const KEY_DISMISSED = "cresos_ws_nudge_dismissed";

type DismissMap = Record<string, number>;

function readDismissed(): DismissMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(KEY_DISMISSED);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DismissMap;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function writeDismissed(map: DismissMap): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY_DISMISSED, JSON.stringify(map));
}

export function dismissCompanionNudge(key: string, minutes = 30): void {
  const map = readDismissed();
  map[key] = Date.now() + minutes * 60_000;
  writeDismissed(map);
}

export function isCompanionNudgeDismissed(key: string): boolean {
  const until = readDismissed()[key];
  return typeof until === "number" && until > Date.now();
}

function tickAccumulated(): number {
  if (typeof window === "undefined") return 0;
  const now = Date.now();
  let start = Number(sessionStorage.getItem(KEY_START));
  if (!Number.isFinite(start) || start <= 0) {
    start = now;
    sessionStorage.setItem(KEY_START, String(start));
  }
  let accum = Number(sessionStorage.getItem(KEY_ACCUM));
  if (!Number.isFinite(accum) || accum < 0) accum = 0;
  const lastTick = Number(sessionStorage.getItem(KEY_LAST_TICK));
  if (document.visibilityState === "visible" && Number.isFinite(lastTick) && lastTick > 0) {
    accum += Math.max(0, (now - lastTick) / 1000);
  }
  sessionStorage.setItem(KEY_ACCUM, String(accum));
  sessionStorage.setItem(KEY_LAST_TICK, String(now));
  return accum;
}

/** Visible-tab active seconds this browser session. */
export function getActiveSeconds(): number {
  return tickAccumulated();
}

export function getActiveMinutes(): number {
  return Math.floor(getActiveSeconds() / 60);
}

export function formatActiveDuration(totalMinutes: number): string {
  if (totalMinutes < 1) return "just now";
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

let trackerStarted = false;

/** Call once per app shell — counts time only while the tab is visible. */
export function initWorkspaceActiveTimeTracker(): () => void {
  if (typeof window === "undefined" || trackerStarted) return () => undefined;
  trackerStarted = true;

  if (!sessionStorage.getItem(KEY_START)) {
    sessionStorage.setItem(KEY_START, String(Date.now()));
  }
  sessionStorage.setItem(KEY_LAST_TICK, String(Date.now()));

  const onVis = () => {
    sessionStorage.setItem(KEY_LAST_TICK, String(Date.now()));
  };

  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("focus", onVis);

  const interval = window.setInterval(() => {
    if (document.visibilityState === "visible") tickAccumulated();
  }, 30_000);

  return () => {
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("focus", onVis);
    window.clearInterval(interval);
    trackerStarted = false;
  };
}

/** Merge client visible time with server session length — use the larger for companion context. */
export function mergedActiveMinutes(serverSessionMinutes: number): number {
  return Math.max(serverSessionMinutes, getActiveMinutes());
}
