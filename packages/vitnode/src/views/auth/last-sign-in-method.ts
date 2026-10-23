import React from "react";

const STORAGE_KEY = "vitnode_last_sign_in_method";

const SSO_PREFIX = "sso:";

const listeners = new Set<() => void>();

const readStored = (): null | string => {
  try {
    return globalThis.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const subscribe = (listener: () => void) => {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };

  listeners.add(listener);
  globalThis.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    globalThis.removeEventListener("storage", onStorage);
  };
};

export type SignInMethod =
  | "passkey"
  | "password"
  | `${typeof SSO_PREFIX}${string}`;

export const ssoSignInMethod = (providerId: string): SignInMethod =>
  `${SSO_PREFIX}${providerId}`;

export const ssoProviderOfMethod = (
  method: null | string,
): string | undefined =>
  method?.startsWith(SSO_PREFIX) ? method.slice(SSO_PREFIX.length) : undefined;

export const rememberSignInMethod = (method: SignInMethod) => {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, method);
  } catch {
    return;
  }

  for (const listener of listeners) listener();
};

export const useLastSignInMethod = (): null | string =>
  React.useSyncExternalStore(subscribe, readStored, () => null);
