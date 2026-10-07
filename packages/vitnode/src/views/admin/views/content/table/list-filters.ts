import type { FilterDataTable } from "@/components/table/filters";
import type { AnyContentTypeDefinition } from "@/content/types";

import {
  CONTENT_PUBLICATION_STATUSES,
  CONTENT_VISIBILITY_FILTERS,
} from "@/content/const";

/**
 * The list filters that are not declared fields: the publication `status` and
 * the record's `visibility`. Each is one equality the API reads as a single
 * value, so each accepts exactly these and nothing else.
 */
export const CONTENT_LIST_SYSTEM_FILTERS: Readonly<
  Record<string, readonly string[]>
> = {
  status: CONTENT_PUBLICATION_STATUSES,
  visibility: CONTENT_VISIBILITY_FILTERS,
};

/**
 * The value a system filter's URL parameter is asking for, or `undefined` for
 * "all".
 *
 * A hand-typed `?visibility=hidden,visible` or `?status=archived` would be a
 * `400` from the API and an error screen instead of a list, so anything that is
 * not exactly one allowed value reads as no filter at all.
 */
export const contentListSystemFilterValue = (
  name: string,
  raw: string,
): string | undefined => {
  const allowed = CONTENT_LIST_SYSTEM_FILTERS[name];

  if (!allowed) return raw;

  return allowed.includes(raw) ? raw : undefined;
};

export interface ContentListFilterLabels {
  /** The option that clears a filter - `core.content.filters.all`. */
  all: string;
  status: { draft: string; label: string; published: string };
  visibility: { hidden: string; label: string; visible: string };
}

/**
 * The toolbar's filters for one content type: status when it publishes,
 * visibility when it hides. They compose - "published and hidden" is the set of
 * records the AdminCP calls published and readers cannot reach.
 */
export const contentListToolbarFilters = (
  definition: Pick<AnyContentTypeDefinition, "publication" | "visibility">,
  labels: ContentListFilterLabels,
): FilterDataTable[] => [
  ...(definition.publication.enabled
    ? [
        {
          id: "status",
          label: labels.status.label,
          options: CONTENT_PUBLICATION_STATUSES.map(value => ({
            label: labels.status[value],
            value,
          })),
          single: { allLabel: labels.all },
        },
      ]
    : []),
  ...(definition.visibility.enabled
    ? [
        {
          id: "visibility",
          label: labels.visibility.label,
          options: (["visible", "hidden"] as const).map(value => ({
            label: labels.visibility[value],
            value,
          })),
          single: { allLabel: labels.all },
        },
      ]
    : []),
];
