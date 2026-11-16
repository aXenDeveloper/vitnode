import { createContentModel } from "@vitnode/api/content/server";

import { letterContentType } from "@/content/letter";

export const letterContent = createContentModel(letterContentType);

export const newsroom_letters = letterContent.table;
