import React from 'react';

export const useBeforeUnload = (
  enabled: (() => boolean) | boolean = true,
  message?: string,
) => {
  const handler = React.useCallback(
    (event: BeforeUnloadEvent) => {
      const finalEnabled = typeof enabled === 'function' ? enabled() : true;

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

    window.addEventListener('beforeunload', handler);

    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, [enabled, handler]);
};

export default useBeforeUnload;
