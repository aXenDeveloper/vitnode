import { fetcherClient } from "@/lib/fetcher-client";
import { PRESENCE_HEARTBEAT_INTERVAL_MS } from "@/lib/user-presence";
import { manifest } from "@/manifest";

export type PresenceHeartbeatResult = "failed" | "ok" | "signed-out";

export type SendPresenceHeartbeat = () => Promise<PresenceHeartbeatResult>;

export const sendPresenceHeartbeat: SendPresenceHeartbeat = async () => {
  try {
    const response = await fetcherClient({
      plugin: manifest.id,
      method: "post",
      module: "users",
      path: "/presence/heartbeat",
    });

    if (response.status === 401) return "signed-out";

    return response.ok ? "ok" : "failed";
  } catch {
    return "failed";
  }
};

export const presenceHeartbeatStorageKey = (userId: number): string =>
  `vitnode:presence-heartbeat:${userId}`;

/**
 * Tabs of one browser share a session, so one heartbeat speaks for all of
 * them. A tab skips its turn when another sent one this recently - early
 * enough that the lease never lapses while any tab is visible.
 */
const SHARED_BEAT_FRESH_MS = PRESENCE_HEARTBEAT_INTERVAL_MS * 0.75;

const readSharedBeat = (key: string): number => {
  try {
    return Number(localStorage.getItem(key));
  } catch {
    return Number.NaN;
  }
};

const writeSharedBeat = (key: string, at: number): void => {
  try {
    localStorage.setItem(key, String(at));
  } catch {
    /* without storage every tab simply sends its own */
  }
};

/**
 * Keeps one signed-in tab's session online: a heartbeat now, then one per
 * interval while the tab is visible, paused while it is hidden and sent again
 * the moment it comes back. One request at a time, and only this timer counts
 * as activity - navigation, prefetching and background queries never do.
 *
 * Returns the function that stops it. Call it from an effect: it touches
 * `document` and `window`, so it never runs during SSR.
 */
export const startPresenceHeartbeat = ({
  intervalMs = PRESENCE_HEARTBEAT_INTERVAL_MS,
  onSignedOut,
  send = sendPresenceHeartbeat,
  storageKey,
}: {
  intervalMs?: number;
  onSignedOut?: () => void;
  send?: SendPresenceHeartbeat;
  storageKey: string;
}): (() => void) => {
  if (typeof document === "undefined") return () => undefined;

  let timer: ReturnType<typeof setInterval> | undefined;
  let inFlight = false;
  let stopped = false;

  const isVisible = () => document.visibilityState === "visible";

  const pause = () => {
    clearInterval(timer);
    timer = undefined;
  };

  const stop = () => {
    stopped = true;
    pause();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("online", beat);
  };

  async function sendBeat() {
    if (stopped || inFlight || !isVisible()) return;

    const now = Date.now();
    const sharedAge = now - readSharedBeat(storageKey);
    if (sharedAge >= 0 && sharedAge < SHARED_BEAT_FRESH_MS) return;

    inFlight = true;
    writeSharedBeat(storageKey, now);
    try {
      if ((await send()) === "signed-out" && !stopped) {
        stop();
        onSignedOut?.();
      }
    } finally {
      inFlight = false;
    }
  }

  function beat() {
    void sendBeat();
  }

  const resume = () => {
    pause();
    beat();
    timer = setInterval(beat, intervalMs);
  };

  function onVisibilityChange() {
    if (isVisible()) {
      resume();
    } else {
      pause();
    }
  }

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("online", beat);
  if (isVisible()) resume();

  return stop;
};
