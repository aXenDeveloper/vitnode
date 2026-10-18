import React from "react";

/**
 * Asks the browser to confirm leaving the page, e.g. with unsaved changes.
 *
 * @param enabled `false` removes the listener; a function is called on every
 * unload attempt to decide. Defaults to `true`.
 * @param message Legacy custom text; most browsers show their own.
 */
export const useBeforeUnload = (
  enabled: (() => boolean) | boolean = true,
  message?: string,
) => {
  const handler = React.useCallback(
    (event: BeforeUnloadEvent) => {
      const finalEnabled = typeof enabled === "function" ? enabled() : true;

      if (!finalEnabled) {
        return;
      }

      event.preventDefault();

      if (message) {
        event.preventDefault();

        return message;
      }

      return message;
    },
    [enabled, message],
  );

  React.useEffect(() => {
    if (!enabled) {
      return;
    }

    window.addEventListener("beforeunload", handler);

    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, [enabled, handler]);
};
