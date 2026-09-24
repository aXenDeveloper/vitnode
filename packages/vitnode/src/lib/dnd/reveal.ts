const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export const revealWhenRendered = (selector: string): void => {
  requestAnimationFrame(() => {
    document.querySelector(selector)?.scrollIntoView({
      behavior: window.matchMedia(REDUCED_MOTION_QUERY).matches
        ? "auto"
        : "smooth",
      block: "nearest",
    });
  });
};
