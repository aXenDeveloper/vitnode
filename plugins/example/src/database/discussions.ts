import { createContentModel } from "@vitnode/core/content/server";

import { discussionContentType } from "@/content/discussion";

export const discussionContent = createContentModel(discussionContentType);

export const example_discussions = discussionContent.table;
