export const ADMIN_TAB_HEARTBEAT_KEY = "vitnode:admin-tab-heartbeat";

export const ADMIN_TAB_CHANNEL = "vitnode:admin-tabs";

export const ADMIN_TAB_HEARTBEAT_INTERVAL_MS = 5_000;

export const ADMIN_TAB_HEARTBEAT_FRESH_MS = 15_000;

export const ADMIN_TAB_PING_TIMEOUT_MS = 750;

const PING = "ping";
const PONG = "pong";

export const isAdminTabHeartbeatFresh = (
  heartbeat: null | string,
  now = Date.now(),
): boolean => {
  const beatAt = Number(heartbeat);
  if (!(heartbeat && Number.isFinite(beatAt))) return false;

  const age = now - beatAt;

  return age >= 0 && age < ADMIN_TAB_HEARTBEAT_FRESH_MS;
};

export type AdminTabHeartbeat =
  | { available: false }
  | { available: true; heartbeat: null | string };

export const readAdminTabHeartbeat = (): AdminTabHeartbeat => {
  try {
    return {
      available: true,
      heartbeat: localStorage.getItem(ADMIN_TAB_HEARTBEAT_KEY),
    };
  } catch {
    return { available: false };
  }
};

export const markAdminTabAlive = (now = Date.now()): boolean => {
  try {
    localStorage.setItem(ADMIN_TAB_HEARTBEAT_KEY, String(now));

    return true;
  } catch {
    return false;
  }
};

export const askOtherAdminTabs = async (
  timeoutMs = ADMIN_TAB_PING_TIMEOUT_MS,
): Promise<boolean> => {
  if (typeof BroadcastChannel === "undefined") return false;

  const channel = new BroadcastChannel(ADMIN_TAB_CHANNEL);

  return await new Promise<boolean>(resolve => {
    const finish = (answered: boolean) => {
      clearTimeout(timer);
      channel.close();
      resolve(answered);
    };
    const timer = setTimeout(() => {
      finish(false);
    }, timeoutMs);

    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (event.data === PONG) finish(true);
    };
    channel.postMessage(PING);
  });
};

export const answerAdminTabPings = (): (() => void) => {
  if (typeof BroadcastChannel === "undefined") return () => undefined;

  const channel = new BroadcastChannel(ADMIN_TAB_CHANNEL);
  channel.onmessage = (event: MessageEvent<unknown>) => {
    if (event.data === PING) channel.postMessage(PONG);
  };

  return () => {
    channel.close();
  };
};

export const isAdminSessionStillInUse = async (): Promise<boolean> => {
  const read = readAdminTabHeartbeat();
  if (!read.available) return true;
  if (isAdminTabHeartbeatFresh(read.heartbeat)) return true;

  return await askOtherAdminTabs();
};

export const keepAdminTabAlive = (): (() => void) => {
  const beat = () => {
    markAdminTabAlive();
  };

  beat();
  const interval = setInterval(beat, ADMIN_TAB_HEARTBEAT_INTERVAL_MS);
  const stopAnswering = answerAdminTabPings();
  window.addEventListener("pagehide", beat);

  return () => {
    clearInterval(interval);
    stopAnswering();
    window.removeEventListener("pagehide", beat);
    beat();
  };
};
