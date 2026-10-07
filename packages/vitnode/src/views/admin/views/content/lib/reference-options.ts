import React from "react";

import type { ContentId } from "@/content/ids";

import { contentIdKey } from "@/content/ids";

import type { ContentOption, ContentOptionsLoader } from "./field-component";

/**
 * Labels for the identifiers a to-many picker holds, fetched once per id.
 *
 * Keyed by `contentIdKey` - the option's own string `value` - so a `serial`
 * target's `7` and a `uuid` or `bigint` target's string ids are looked up the
 * same way, and a bigint is never rounded through `Number`.
 */
export const useReferenceOptions = ({
  field,
  ids,
  load,
}: {
  field: string;
  ids: readonly ContentId[];
  load: ContentOptionsLoader;
}) => {
  const [known, setKnown] = React.useState<Record<string, ContentOption>>({});

  const [asked, setAsked] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // The ids are a fresh array on every render; the *set* of them is what a
  // lookup depends on, so the effect keys off the joined key rather than the
  // identity of the array. Commas cannot occur in any strategy's id.
  const missing = ids
    .map(contentIdKey)
    .filter(key => known[key] === undefined && !asked.has(key));
  const missingKey = missing.join(",");

  React.useEffect(() => {
    if (missingKey === "") return;

    let active = true;

    const requested = missingKey.split(",");

    // Sent as their keys: the options route reads each one under the target's
    // own strategy, so `"7"` and `7` name the same serial record.
    void load({
      field,
      ids: requested,
      search: "",
    })
      .then(options => {
        if (!active) return;

        setKnown(current => ({
          ...current,
          ...Object.fromEntries(options.map(option => [option.value, option])),
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
    pending: (id: ContentId): boolean => {
      const key = contentIdKey(id);

      return known[key] === undefined && !asked.has(key);
    },
    /** Remembers what a picker just resolved, so a fresh choice reads in full. */
    remember: (options: readonly ContentOption[]) => {
      setKnown(current => ({
        ...current,
        ...Object.fromEntries(options.map(option => [option.value, option])),
      }));
    },
  };
};
