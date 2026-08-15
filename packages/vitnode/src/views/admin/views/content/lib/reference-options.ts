import React from "react";

import type { ContentOption, ContentOptionsLoader } from "./field-component";

/**
 * The options a to-many picker has learned, and the loader that fills the gaps.
 *
 * A form opens holding identifiers and nothing else - a to-many field has no
 * column on the row for a label to have been joined onto - so the options are
 * fetched once, for exactly the ids in hand, and then kept as the editor picks
 * more. Without this an article's co-authors would open as `7` and `12`.
 *
 * Whole options rather than labels, because a name is not all a picker draws: a
 * person has a face and a handle, a category has a colour, and both arrive on
 * the same object the search returned.
 */
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
  /**
   * The ids a lookup has already come back for, whatever it came back with.
   *
   * Separate from `known` because the two answer different questions: `known`
   * is "what does this id read as", and this is "has anybody asked yet". An id
   * whose target has since been deleted is never in `known` and always in here,
   * so it settles on its number instead of shimmering forever.
   */
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
