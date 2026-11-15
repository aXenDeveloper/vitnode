import { describe, expectTypeOf, it } from "vitest";

import {
  testNoticeCommentContentType,
  testNoticeTopicContentType,
  testTopicPublishedNotification,
} from "@/tests/content-notification-fixtures";

import { buildContentNotifications } from "./define";

const messages = { comment: "c", label: "l", reply: "r" };

describe("buildContentNotifications", () => {
  it("accepts the user fields of the content type and its root", () => {
    buildContentNotifications({
      content: testNoticeCommentContentType,
      root: testNoticeTopicContentType,
      rules: {
        replies: {
          id: "ntest.comment_reply",
          messages,
          preset: "threadReply",
          recipients: { authorField: "author", rootAuthorField: "author" },
          target: ({ content, root }) => {
            expectTypeOf(content.body).toEqualTypeOf<string>();
            expectTypeOf(root.title).toEqualTypeOf<string>();

            return "/";
          },
        },
      },
    });
  });

  it("rejects an author field that is not a user field", () => {
    buildContentNotifications({
      content: testNoticeCommentContentType,
      root: testNoticeTopicContentType,
      rules: {
        replies: {
          id: "ntest.comment_reply",
          messages,
          preset: "threadReply",
          recipients: {
            // @ts-expect-error - `body` is a text field
            authorField: "body",
            // @ts-expect-error - `title` is a text field of the root
            rootAuthorField: "title",
          },
          target: () => "/",
        },
      },
    });
  });

  it("types a custom rule's data by its notification type", () => {
    buildContentNotifications({
      content: testNoticeTopicContentType,
      rules: {
        published: {
          data: ({ content }) => ({
            contentId: String(content.id),
            contentTypeId: "ntest.topic",
            title: content.title,
          }),
          on: "firstPublication",
          recipients: ({ content }) => [content.author],
          type: testTopicPublishedNotification,
        },
      },
    });

    buildContentNotifications({
      content: testNoticeTopicContentType,
      rules: {
        published: {
          data: () => ({ contentId: "1", contentTypeId: "ntest.topic" }),
          on: "firstPublication",
          recipients: () => [],
          // @ts-expect-error - the type's data needs a `title`
          type: testTopicPublishedNotification,
        },
      },
    });
  });
});
