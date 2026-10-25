import { createContentModel } from "@vitnode/core/content/server";

import { letterContentType } from "@/content/letter";

export const letterContent = createContentModel(letterContentType);

export const newsroom_letters = letterContent.table;
