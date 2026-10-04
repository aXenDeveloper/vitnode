/**
 * Collapses a burst of calls into one: it fires `wait` ms after the last call,
 * but never later than `maxWait` ms after the first, so a steady stream of
 * notifications still refreshes the list instead of postponing it forever.
 */
export const createCoalescer = (
  run: () => void,
  { maxWait, wait }: { maxWait: number; wait: number },
) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let firstCallAt: null | number = null;

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    firstCallAt = null;
    run();
  };

  return {
    cancel: () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
      firstCallAt = null;
    },
    schedule: () => {
      const now = Date.now();
      firstCallAt ??= now;
      if (timer) clearTimeout(timer);
      const delay = Math.max(0, Math.min(wait, firstCallAt + maxWait - now));
      timer = setTimeout(flush, delay);
    },
  };
};
