import React from "react";

const COARSE_POINTER_QUERY = "(hover: none) and (pointer: coarse)";

const subscribe = (onStoreChange: () => void) => {
  const mql = window.matchMedia(COARSE_POINTER_QUERY);
  mql.addEventListener("change", onStoreChange);

  return () => {
    mql.removeEventListener("change", onStoreChange);
  };
};

const getSnapshot = () => window.matchMedia(COARSE_POINTER_QUERY).matches;

const getServerSnapshot = () => false;

/**
 * Whether the primary input is a finger: no hover, coarse pointer - phones and
 * tablets. Hover-only UI needs a tap alternative there. Always `false` during
 * SSR, so the first client render matches the server.
 */
export function useCoarsePointer() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
