import React from "react";

const MOBILE_BREAKPOINT = 768;
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

const subscribe = (onStoreChange: () => void) => {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener("change", onStoreChange);

  return () => {
    mql.removeEventListener("change", onStoreChange);
  };
};

const getSnapshot = () => window.matchMedia(MOBILE_QUERY).matches;

const getServerSnapshot = () => false;

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
