import { createContentModel } from "@vitnode/core/content/server";

import { pageContentType } from "@/content/page";

export const pageContent = createContentModel(pageContentType);

export const newsroom_pages = pageContent.table;
