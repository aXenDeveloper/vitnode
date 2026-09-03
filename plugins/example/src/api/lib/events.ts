import type { ContentEventsFor } from "@vitnode/core/content";

import type { articleContentType } from "@/content/article";
import type { categoryContentType } from "@/content/category";

declare module "@vitnode/core/api/models/events" {
  interface VitNodeEvents
    extends
      ContentEventsFor<typeof articleContentType>,
      ContentEventsFor<typeof categoryContentType> {}
}
