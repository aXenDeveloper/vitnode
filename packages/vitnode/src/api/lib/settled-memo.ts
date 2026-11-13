import { currentRealtimeScope } from "@/ws/runtime";

const processOwner = {};

export const inFlightOwner = (): object => {
  const scope = currentRealtimeScope();

  return scope?.resources ?? scope ?? processOwner;
};

export interface SettledMemo<T> {
  get: (load: () => Promise<T>) => Promise<T>;
  reset: () => void;
}

export const createSettledMemo = <T>(): SettledMemo<T> => {
  let settled: undefined | { value: T };
  let pending = new WeakMap<object, Promise<T>>();

  return {
    get: async load => {
      if (settled) return settled.value;

      const owner = inFlightOwner();
      const inFlight = pending.get(owner);
      if (inFlight) return await inFlight;

      const loading = load().then(value => {
        settled = { value };

        return value;
      });
      pending.set(owner, loading);

      try {
        return await loading;
      } finally {
        pending.delete(owner);
      }
    },
    reset: () => {
      settled = undefined;
      pending = new WeakMap();
    },
  };
};
