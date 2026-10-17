import type { ContentEventsFor } from "@vitnode/core/content";

import { buildEventListener } from "@vitnode/core/api/lib/events";
import { contentEventName } from "@vitnode/core/content";

import { commentContentType } from "@/content/comment";
import { forumContainers } from "@/content/forums";
import { topicContentType } from "@/content/topic";

import { invalidateForumStats } from "./stats-cache";

declare module "@vitnode/core/api/models/events" {
  interface VitNodeEvents
    extends
      ContentEventsFor<typeof commentContentType>,
      ContentEventsFor<typeof topicContentType> {}
}

const TOPIC = topicContentType.id;
const COMMENT = commentContentType.id;

const description = "Expires the cached forum and topic stats";

/**
 * Every action that can change a count, a "last comment" time or a forum's
 * newest topic. A topic `updated` covers a move between forums and a new title
 * or slug on the newest topic; a comment `updated` only matters when it moved
 * to another topic - a body edit changes no stat.
 */
const topicActions = [
  "created",
  "deleted",
  "hidden",
  "published",
  "restored",
  "unhidden",
  "unpublished",
  "updated",
] as const;

const commentActions = [
  "created",
  "deleted",
  "hidden",
  "published",
  "unhidden",
  "unpublished",
] as const;

export const forumStatsEventListeners = [
  ...topicActions.map(action =>
    buildEventListener({
      event: contentEventName(TOPIC, action),
      name: `forum-stats-topic-${action}`,
      description,
      handler: async c => {
        await invalidateForumStats(c);
      },
    }),
  ),
  ...commentActions.map(action =>
    buildEventListener({
      event: contentEventName(COMMENT, action),
      name: `forum-stats-comment-${action}`,
      description,
      handler: async c => {
        await invalidateForumStats(c);
      },
    }),
  ),
  ...(["updated", "restored"] as const).map(action =>
    buildEventListener({
      event: contentEventName(COMMENT, action),
      name: `forum-stats-comment-${action}`,
      description,
      handler: async (c, payload) => {
        if (!payload.changedFields.includes("topic")) return;

        await invalidateForumStats(c);
      },
    }),
  ),
  buildEventListener({
    event: "content.container.deleted",
    name: "forum-stats-forum-deleted",
    description,
    handler: async (c, payload) => {
      if (payload.definitionId !== forumContainers.id) return;

      await invalidateForumStats(c);
    },
  }),
];
