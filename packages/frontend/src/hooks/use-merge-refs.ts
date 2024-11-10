import React from 'react';

/**
 * Merges an array of refs into a single memoized callback ref or `null`.
 * @see https://floating-ui.com/docs/useMergeRefs
 */
export function useMergeRefs<Instance>(
  refs: (React.Ref<Instance> | undefined)[],
): null | React.RefCallback<Instance> {
  return React.useMemo(() => {
    if (refs.every(ref => ref == null)) {
      return null;
    }

    return value => {
      refs.forEach(ref => {
        if (typeof ref === 'function') {
          ref(value);
        } else if (ref != null) {
          (ref as React.MutableRefObject<Instance | null>).current = value;
        }
      });
    };
  }, [refs]);
}
