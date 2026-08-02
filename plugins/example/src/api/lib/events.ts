import type { ContentEventsFor } from "@vitnode/core/content";

import type { articleContentType } from "@/content/article";
import type { categoryContentType } from "@/content/category";

/**
 * Grafts the generated content events onto the global event map.
 *
 * One line per content type is all it takes: `ContentEventsFor` expands to
 * `content.example.article.created | .updated | .deleted` with typed payloads,
 * so `changedFields` narrows to this content type's own field names.
 */
declare module "@vitnode/core/api/models/events" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- members come from the mapped types
  interface VitNodeEvents
    extends ContentEventsFor<typeof articleContentType>,
      ContentEventsFor<typeof categoryContentType> {}
}

export {};
