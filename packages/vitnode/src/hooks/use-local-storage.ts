import React from "react";

type SetLocalStorageValue<T> = (value: ((previous: T) => T) | T) => void;

const memoryFallback = new Map<string, string>();

const readRaw = (key: string): null | string => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memoryFallback.get(key) ?? null;
  }
};

const writeRaw = (key: string, raw: null | string) => {
  try {
    if (raw === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, raw);
    }
  } catch {
    if (raw === null) {
      memoryFallback.delete(key);
    } else {
      memoryFallback.set(key, raw);
    }
  }

  window.dispatchEvent(new StorageEvent("storage", { key }));
};

const missing = Symbol("missing");

const parse = (raw: null | string): unknown => {
  if (raw === null) return missing;

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return missing;
  }
};

const valueOrDefault = <T>(parsed: unknown, defaultValue: T): T =>
  parsed === missing ? defaultValue : (parsed as T);

const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);

  return () => {
    window.removeEventListener("storage", onChange);
  };
};

const getServerSnapshot = () => null;

export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
): [T, SetLocalStorageValue<T>, () => void] {
  const raw = React.useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    getServerSnapshot,
  );
  const parsed = React.useMemo(() => parse(raw), [raw]);
  const value = valueOrDefault(parsed, defaultValue);

  const setValue: SetLocalStorageValue<T> = React.useCallback(
    next => {
      const resolved =
        next instanceof Function
          ? next(valueOrDefault(parse(readRaw(key)), defaultValue))
          : next;

      writeRaw(key, JSON.stringify(resolved));
    },
    [key, defaultValue],
  );

  const removeValue = React.useCallback(() => {
    writeRaw(key, null);
  }, [key]);

  return [value, setValue, removeValue];
}
