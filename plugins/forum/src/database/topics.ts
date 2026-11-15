import { createContentModel } from "@vitnode/api/content/server";

import { topicContentType } from "@/content/topic";

export const topicContent = createContentModel(topicContentType);

export const forum_topics = topicContent.table;
