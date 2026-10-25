import type { ContentEventsFor } from "@vitnode/core/content";

import type { categoryContentType } from "@/content/category";
import type { storyContentType } from "@/content/story";

declare module "@vitnode/core/api/models/events" {
  interface VitNodeEvents
    extends
      ContentEventsFor<typeof storyContentType>,
      ContentEventsFor<typeof categoryContentType> {}
}
