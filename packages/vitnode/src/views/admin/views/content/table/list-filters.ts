import type { FilterDataTable } from "@/components/table/filters";
import type { AnyContentTypeDefinition } from "@/content/types";

import {
  CONTENT_PUBLICATION_STATUSES,
  CONTENT_VISIBILITY_FILTERS,
} from "@/content/const";

const CONTENT_LIST_SYSTEM_FILTERS: Readonly<Record<string, readonly string[]>> =
  {
    status: CONTENT_PUBLICATION_STATUSES,
    visibility: CONTENT_VISIBILITY_FILTERS,
  };

export const contentListSystemFilterValue = (
  name: string,
  raw: string,
): string | undefined => {
  const allowed = CONTENT_LIST_SYSTEM_FILTERS[name];

  if (!allowed) return raw;

  return allowed.includes(raw) ? raw : undefined;
};

export interface ContentListFilterLabels {
  all: string;
  status: { draft: string; label: string; published: string };
  visibility: { hidden: string; label: string; visible: string };
}

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
