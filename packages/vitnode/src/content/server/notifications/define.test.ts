import type { Context } from "hono";

import { describe, expect, it, vi } from "vitest";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";

import { buildApiPlugin } from "@/api/lib/plugin";
import { ContentEngineError } from "@/content/errors";
import {
  noticeComments,
  noticeQuiet,
  noticeTopics,
  testNoticeCommentContentType,
  testNoticeQuietContentType,
  testNoticeTopicContentType,
  testTopicPublishedNotification,
} from "@/tests/content-notification-fixtures";
import { testManifest } from "@/tests/manifest";

import type { ContentDatabase } from "../service";

import { buildContentNotifications } from "./define";
import {
  recordContentFirstPublication,
  recordContentModerationDecision,
  recordContentNotificationCleanup,
} from "./intents";
import { processContentNotificationIntent } from "./process";
import { createContentNotificationRegistry } from "./registry";

const MESSAGES = {
  reply: { comment: "t.comment", label: "t.label", reply: "t.reply" },
  decision: {
    approved: "t.approved",
    label: "t.label",
    rejected: "t.rejected",
  },
};

const replyRule = (id = "ntest.comment_reply") => ({
  id,
  messages: MESSAGES.reply,
  preset: "threadReply" as const,
  recipients: {
    authorField: "author" as const,
    rootAuthorField: "author" as const,
  },
  target: () => "/",
});

const decisionRule = (id = "ntest.comment_decision") => ({
  id,
  messages: MESSAGES.decision,
  preset: "moderationDecision" as const,
  target: () => null,
});

const commentNotifications = () =>
  buildContentNotifications({
    content: testNoticeCommentContentType,
    root: testNoticeTopicContentType,
    rules: { decisions: decisionRule(), replies: replyRule() },
  });

const topicNotifications = () =>
  buildContentNotifications({
    content: testNoticeTopicContentType,
    rules: {
      published: {
        data: () => ({
          contentId: "1",
          contentTypeId: "ntest.topic",
          title: "T",
        }),
        on: "firstPublication",
        recipients: () => [],
        type: testTopicPublishedNotification,
      },
    },
  });

const MODELS = [noticeTopics, noticeComments, noticeQuiet].map(model => ({
  model,
  pluginId: "@vitnode/ntest",
}));

describe("buildContentNotifications", () => {
  it("registers one notification type per rule under the rule's id, whatever its key", () => {
    const renamed = buildContentNotifications({
      content: testNoticeCommentContentType,
      root: testNoticeTopicContentType,
      rules: { a: decisionRule(), b: replyRule() },
    });

    for (const config of [commentNotifications(), renamed]) {
      expect(config.notificationTypes).toEqual([
        expect.objectContaining({
          category: "content",
          defaults: { email: "none", inApp: true },
          id: "ntest.comment_decision",
          subjectType: "ntest.comment",
        }),
        expect.objectContaining({ id: "ntest.comment_reply" }),
      ]);
    }
    expect(topicNotifications().notificationTypes).toEqual([
      testTopicPublishedNotification,
    ]);
  });

  it.each([
    [
      "an author field that is not a user field",
      () =>
        buildContentNotifications({
          content: testNoticeCommentContentType,
          root: testNoticeTopicContentType,
          rules: {
            replies: {
              ...replyRule(),
              recipients: { authorField: "body" as never },
            },
          },
        }),
      /"ntest.comment.body" must be a to-one, shared `field.user\(\)`/,
    ],
    [
      "a root author field that does not exist",
      () =>
        buildContentNotifications({
          content: testNoticeCommentContentType,
          root: testNoticeTopicContentType,
          rules: {
            replies: {
              ...replyRule(),
              recipients: {
                authorField: "author",
                rootAuthorField: "owner" as never,
              },
            },
          },
        }),
      /"ntest.topic" has no field "owner"/,
    ],
    [
      "threadReply on a content type without a thread",
      () =>
        buildContentNotifications({
          content: testNoticeTopicContentType,
          root: testNoticeQuietContentType,
          rules: { replies: replyRule() as never },
        }),
      /needs `thread` on the content type/,
    ],
    [
      "threadReply without a root",
      () =>
        buildContentNotifications({
          content: testNoticeCommentContentType,
          rules: { replies: replyRule() as never },
        }),
      /pass the thread's root content type as `root`/,
    ],
    [
      "two rules with one id",
      () =>
        buildContentNotifications({
          content: testNoticeCommentContentType,
          root: testNoticeTopicContentType,
          rules: {
            first: decisionRule("ntest.same"),
            second: replyRule("ntest.same"),
          },
        }),
      /rule "second" reuses the notification id "ntest.same"/,
    ],
    [
      "no rules",
      () =>
        buildContentNotifications({
          content: testNoticeCommentContentType,
          rules: {},
        }),
      /`rules` is empty/,
    ],
    [
      "the content type as its own root",
      () =>
        buildContentNotifications({
          content: testNoticeTopicContentType,
          root: testNoticeTopicContentType,
          rules: { decisions: decisionRule() },
        }),
      /`root` must be another content type/,
    ],
    [
      "no decisions to notify about",
      () =>
        buildContentNotifications({
          content: testNoticeTopicContentType,
          rules: { decisions: { ...decisionRule(), decisions: [] } },
        }),
      /has an empty `decisions`/,
    ],
  ])("rejects %s", (_, build, message) => {
    expect(build).toThrow(ContentEngineError);
    expect(build).toThrow(message);
  });
});

describe("createContentNotificationRegistry", () => {
  it.each([
    [
      "a content type without a registered model",
      [{ config: commentNotifications(), pluginId: "@vitnode/ntest" }],
      MODELS.filter(entry => entry.model !== noticeComments),
      /"ntest.comment" has no registered model/,
    ],
    [
      "a root without a registered model",
      [{ config: commentNotifications(), pluginId: "@vitnode/ntest" }],
      MODELS.filter(entry => entry.model !== noticeTopics),
      /the root "ntest.topic" has no registered model/,
    ],
    [
      "a root other than the thread's",
      [
        {
          config: buildContentNotifications({
            content: testNoticeCommentContentType,
            root: testNoticeQuietContentType,
            rules: { replies: replyRule() as never },
          }),
          pluginId: "@vitnode/ntest",
        },
      ],
      MODELS,
      /names "ntest.quiet" as its root, but `thread.root` points at "ntest.topic"/,
    ],
  ])("rejects %s", (_, entries, models, message) => {
    const create = () => createContentNotificationRegistry(entries, models);

    expect(create).toThrow(ContentEngineError);
    expect(create).toThrow(message);
  });

  it("finds rules by trigger and type, and the content types a delete must clean up after", () => {
    const registry = createContentNotificationRegistry(
      [
        { config: commentNotifications(), pluginId: "@vitnode/ntest" },
        { config: topicNotifications(), pluginId: "@vitnode/ntest" },
      ],
      MODELS,
    );
    const ruleIds = (
      contentTypeId: string,
      trigger: "firstPublication" | "moderationDecision",
    ) =>
      registry
        .rulesFor(contentTypeId, trigger)
        .map(entry => entry.rule.type.id);

    expect(ruleIds("ntest.comment", "firstPublication")).toEqual([
      "ntest.comment_reply",
    ]);
    expect(ruleIds("ntest.comment", "moderationDecision")).toEqual([
      "ntest.comment_decision",
    ]);
    expect(ruleIds("ntest.topic", "firstPublication")).toEqual([
      "ntest.topic_published",
    ]);
    expect(registry.get("ntest.comment_reply")).toMatchObject({
      pluginId: "@vitnode/ntest",
      rule: { key: "replies", kind: "threadReply" },
    });
    expect(
      ["ntest.comment", "ntest.topic", "ntest.quiet"].map(id =>
        registry.hasDependents(id),
      ),
    ).toEqual([true, true, false]);
  });
});

describe("buildApiPlugin contentNotifications", () => {
  it("registers each rule's type once, also when the plugin lists it itself", () => {
    const plugin = buildApiPlugin({
      contentNotifications: [commentNotifications(), topicNotifications()],
      manifest: testManifest("@vitnode/ntest"),
      modules: [],
      notificationTypes: [testTopicPublishedNotification],
    });

    expect(plugin.notificationTypes?.map(type => type.id)).toEqual([
      "ntest.topic_published",
      "ntest.comment_decision",
      "ntest.comment_reply",
    ]);
    expect(plugin.contentNotifications).toHaveLength(2);
  });

  it("builds a plugin without content notifications", () => {
    const plugin = buildApiPlugin({
      manifest: testManifest("@vitnode/ntest"),
      modules: [],
    });

    expect(plugin.contentNotifications).toBeUndefined();
    expect(plugin.notificationTypes).toEqual([]);
  });
});

describe("content notifications without rules", () => {
  const contextWith = (core: Record<string, unknown>) => {
    const dispatch = vi.fn();
    const warn = vi.fn(async () => {});
    const c = {
      get: (key: string) => ({ core, log: { warn }, queue: { dispatch } })[key],
    } as unknown as Context<EnvVitNode>;

    return { c, dispatch, warn };
  };
  const tx = {} as ContentDatabase;

  it.each([
    ["an install without content notifications", {}],
    [
      "a content type no rule is about",
      {
        contentNotifications: createContentNotificationRegistry(
          [{ config: commentNotifications(), pluginId: "@vitnode/ntest" }],
          MODELS,
        ),
      },
    ],
  ])("stores no intent for %s", async (_, core) => {
    const { c, dispatch } = contextWith(core);
    const definition = testNoticeQuietContentType;

    await recordContentFirstPublication(c, tx, {
      actorId: 1,
      definition,
      itemId: 1,
    });
    await recordContentModerationDecision(c, tx, {
      contentTypeId: definition.id,
      id: 1,
      itemId: "1",
      reviewerId: 1,
      status: "approved",
    });
    await recordContentNotificationCleanup(c, tx, { definition, itemId: 1 });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it.each([
    ["an unreadable intent", { trigger: "firstPublication", v: 2 }, "invalid"],
    [
      "an intent whose rules are gone",
      {
        actorId: 1,
        contentTypeId: "ntest.comment",
        itemId: "1",
        ruleIds: ["ntest.removed"],
        trigger: "firstPublication",
        v: 1,
      },
      "no_rules",
    ],
  ])("skips %s with a warning", async (_, payload, reason) => {
    const { c, warn } = contextWith({});

    await expect(processContentNotificationIntent(c, payload)).resolves.toEqual(
      {
        reason,
        status: "skipped",
      },
    );
    expect(warn).toHaveBeenCalledOnce();
  });
});
