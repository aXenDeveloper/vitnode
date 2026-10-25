import { z } from "zod";

import { buildNotificationType } from "@/api/lib/notifications/registry";
import { defineContentType } from "@/content/define";
import { field } from "@/content/fields";
import { createContentModel } from "@/content/server/model";
import { contentNotificationAccess } from "@/content/server/notifications/access";

/** A thread root: editorial, so it can be scheduled, and hideable. */
export const testNoticeTopicContentType = defineContentType({
  id: "ntest.topic",
  tableName: "ntest_topics",
  publication: true,
  visibility: true,
  editorial: true,
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    author: field.user({ nullable: true, onDelete: "set null" }),
  },
  admin: { titleField: "title" },
});

/** Comments on a topic, threaded by `parent`; deleting the topic cascades. */
export const testNoticeCommentContentType = defineContentType({
  id: "ntest.comment",
  tableName: "ntest_comments",
  publication: true,
  visibility: true,
  fields: {
    slug: field.slug({ generated: true }),
    body: field.text({ required: true, maxLength: 2000 }),
    author: field.user({ nullable: true, onDelete: "set null" }),
    topic: field.relation({
      target: () => testNoticeTopicContentType,
      required: true,
      onDelete: "cascade",
    }),
    parent: field.relation({
      self: true,
      nullable: true,
      onDelete: "set null",
    }),
  },
  publicApi: {
    path: "ntest-comments",
    fields: ["id", "slug", "body", "topic", "parent", "publishedAt"],
  },
  thread: { parent: "parent", root: "topic", maxDepth: 4 },
});

/** A content type with no notification rules. */
export const testNoticeQuietContentType = defineContentType({
  id: "ntest.quiet",
  tableName: "ntest_quiet",
  publication: true,
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    author: field.user({ nullable: true, onDelete: "set null" }),
  },
});

export interface TestTopicPublishedData {
  contentId: string;
  contentTypeId: string;
  parentId?: null | string;
  rootId?: null | string;
  title: string;
}

/** A custom type for a custom `firstPublication` rule on topics. */
export const testTopicPublishedNotification =
  buildNotificationType<TestTopicPublishedData>({
    access: contentNotificationAccess({
      content: testNoticeTopicContentType,
      policy: "content",
    }),
    category: "content",
    defaults: { email: "none", inApp: true },
    id: "ntest.topic_published",
    label: "ntest.topic_published.label",
    present: ({ data }) => ({ target: null, title: data.title }),
    schema: z.object({
      contentId: z.string(),
      contentTypeId: z.string(),
      parentId: z.string().nullable().optional(),
      rootId: z.string().nullable().optional(),
      title: z.string().min(1),
    }),
    subjectType: "ntest.topic",
    version: 1,
  });

export const noticeTopics = createContentModel(testNoticeTopicContentType);
export const noticeComments = createContentModel(testNoticeCommentContentType, {
  references: { topic: () => noticeTopics.table.id },
});
export const noticeQuiet = createContentModel(testNoticeQuietContentType);
