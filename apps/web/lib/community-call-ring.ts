/**
 * WhatsApp-style incoming call ring + outgoing ringback (Web Audio API).
 * Call unlockCommunityCallAudio() after a user gesture on Community.
 */

let audioCtx: AudioContext | null = null;
let incomingActive = false;
let outgoingActive = false;
let incomingLoopTimer: ReturnType<typeof setTimeout> | null = null;
let outgoingLoopTimer: ReturnType<typeof setTimeout> | null = null;
let vibrateTimer: ReturnType<typeof setInterval> | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!audioCtx) audioCtx = new Ctor();
    return audioCtx;
  } catch {
    return null;
  }
}

export function unlockCommunityCallAudio(): void {
  const ctx = getCtx();
  if (ctx?.state === "suspended") {
    void ctx.resume().catch(() => undefined);
  }
}

function stopVibrate(): void {
  if (vibrateTimer) {
    clearInterval(vibrateTimer);
    vibrateTimer = null;
  }
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(0);
    }
  } catch {
    // ignore
  }
}

function startVibrate(): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  stopVibrate();
  try {
    navigator.vibrate([180, 120, 180, 120, 180, 900]);
    vibrateTimer = setInterval(() => {
      try {
        navigator.vibrate([180, 120, 180, 120, 180, 900]);
      } catch {
        // ignore
      }
    }, 2600);
  } catch {
    // ignore
  }
}

/** Two-tone burst pattern similar to classic mobile / WhatsApp ring cadence */
function playRingCycle(ctx: AudioContext, variant: "incoming" | "outgoing"): void {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.35, now + 0.02);
  master.gain.setValueAtTime(0.35, now + 1.05);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);
  master.connect(ctx.destination);

  const f1 = variant === "incoming" ? 425 : 400;
  const f2 = variant === "incoming" ? 525 : 500;

  const bursts: { start: number; dur: number; freq: number }[] = [
    { start: 0, dur: 0.38, freq: f1 },
    { start: 0.42, dur: 0.38, freq: f2 },
    { start: 0.84, dur: 0.38, freq: f1 },
    { start: 1.26, dur: 0.38, freq: f2 }
  ];

  for (const b of bursts) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(b.freq, now + b.start);
    g.gain.setValueAtTime(0.0001, now + b.start);
    g.gain.exponentialRampToValueAtTime(0.55, now + b.start + 0.02);
    g.gain.setValueAtTime(0.55, now + b.start + b.dur - 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, now + b.start + b.dur);
    osc.connect(g);
    g.connect(master);
    osc.start(now + b.start);
    osc.stop(now + b.start + b.dur + 0.05);
  }
}

function scheduleIncomingLoop(): void {
  if (!incomingActive) return;
  const ctx = getCtx();
  if (!ctx) return;
  void ctx.resume().then(() => {
    if (!incomingActive) return;
    playRingCycle(ctx, "incoming");
    incomingLoopTimer = setTimeout(scheduleIncomingLoop, 2400);
  });
}

function scheduleOutgoingLoop(): void {
  if (!outgoingActive) return;
  const ctx = getCtx();
  if (!ctx) return;
  void ctx.resume().then(() => {
    if (!outgoingActive) return;
    playRingCycle(ctx, "outgoing");
    outgoingLoopTimer = setTimeout(scheduleOutgoingLoop, 2400);
  });
}

export function startIncomingCallRing(): void {
  incomingActive = true;
  unlockCommunityCallAudio();
  if (incomingLoopTimer) clearTimeout(incomingLoopTimer);
  scheduleIncomingLoop();
  startVibrate();
}

export function stopIncomingCallRing(): void {
  incomingActive = false;
  if (incomingLoopTimer) {
    clearTimeout(incomingLoopTimer);
    incomingLoopTimer = null;
  }
  stopVibrate();
}

export function startOutgoingRingback(): void {
  outgoingActive = true;
  unlockCommunityCallAudio();
  if (outgoingLoopTimer) clearTimeout(outgoingLoopTimer);
  scheduleOutgoingLoop();
}

export function stopOutgoingRingback(): void {
  outgoingActive = false;
  if (outgoingLoopTimer) {
    clearTimeout(outgoingLoopTimer);
    outgoingLoopTimer = null;
  }
}

export function stopAllCallSounds(): void {
  stopIncomingCallRing();
  stopOutgoingRingback();
}

/** Desktop notification when tab is in background (if permission already granted). */
export function notifyIncomingCallIfHidden(callerName: string, callType: string): void {
  if (typeof document === "undefined" || !document.hidden) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification("Incoming call", {
      body: `${callerName} — ${callType} call`,
      tag: "cresos-incoming-call",
      requireInteraction: true
    });
  } catch {
    // ignore
  }
}
