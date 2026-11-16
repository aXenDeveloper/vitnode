import { createContentModel } from "@vitnode/api/content/server";

import { categoryContentType } from "@/content/category";

export const categoryContent = createContentModel(categoryContentType);

export const newsroom_categories = categoryContent.table;
