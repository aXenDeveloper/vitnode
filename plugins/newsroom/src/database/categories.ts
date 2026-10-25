import { createContentModel } from "@vitnode/core/content/server";

import { categoryContentType } from "@/content/category";

export const categoryContent = createContentModel(categoryContentType);

export const newsroom_categories = categoryContent.table;
