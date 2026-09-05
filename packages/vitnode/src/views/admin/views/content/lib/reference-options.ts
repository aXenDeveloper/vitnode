import React from "react";

import type { ContentOption, ContentOptionsLoader } from "./field-component";

export const useReferenceOptions = ({
  field,
  ids,
  load,
}: {
  field: string;
  ids: number[];
  load: ContentOptionsLoader;
}) => {
  const [known, setKnown] = React.useState<Record<number, ContentOption>>({});

  const [asked, setAsked] = React.useState<ReadonlySet<number>>(
    () => new Set(),
  );
  // The ids are a fresh array on every render; the *set* of them is what a
  // lookup depends on, so the effect keys off the sorted key rather than the
  // identity of the array.
  const missing = ids.filter(id => known[id] === undefined && !asked.has(id));
  const missingKey = missing.join(",");

  React.useEffect(() => {
    if (missingKey === "") return;

    let active = true;
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-pass-live-state-to-parent -- `load` is a fetch, not a parent callback: it takes the ids nobody has looked up yet and answers with their labels. The state it reads is the record of what has already been asked for, which is exactly what keeps the fetch from repeating.
    const requested = missingKey.split(",").map(Number);

    void load({
      field,
      ids: requested,
      search: "",
    })
      .then(options => {
        if (!active) return;

        setKnown(current => ({
          ...current,
          ...Object.fromEntries(
            options.map(option => [Number(option.value), option]),
          ),
        }));
      })
      // Marked asked either way, and in a `finally` rather than beside the
      // `setKnown` above: a lookup that fails has still been made, and leaving
      // these unasked would spin the same request on the next render forever.
      .finally(() => {
        if (!active) return;

        setAsked(current => new Set([...current, ...requested]));
      });

    return () => {
      active = false;
    };
  }, [field, load, missingKey]);

  return {
    known,
    /**
     * Whether this id is still being looked up - so a chip can render a
     * skeleton rather than the identifier it is about to stop being.
     */
    pending: (id: number): boolean => known[id] === undefined && !asked.has(id),
    /** Remembers what a picker just resolved, so a fresh choice reads in full. */
    remember: (options: readonly ContentOption[]) => {
      setKnown(current => ({
        ...current,
        ...Object.fromEntries(
          options.map(option => [Number(option.value), option]),
        ),
      }));
    },
  };
};
