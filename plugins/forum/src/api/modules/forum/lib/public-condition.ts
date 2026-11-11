import type { PgColumn } from "drizzle-orm/pg-core";

import {
  publicationColumns,
  publishedCondition,
} from "@vitnode/core/content/server";

import { commentContent } from "@/database/comments";
import { topicContent } from "@/database/topics";

const topicColumns = topicContent.columns as Record<string, PgColumn>;
const commentColumns = commentContent.columns as Record<string, PgColumn>;

export const publicTopic = () =>
  publishedCondition(publicationColumns(topicContent.definition, topicColumns));

export const publicComment = () =>
  publishedCondition(
    publicationColumns(commentContent.definition, commentColumns),
  );
