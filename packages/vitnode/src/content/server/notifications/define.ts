import type { Context } from "hono";

import { z } from "zod";

import type {
  AnyNotificationTypeDefinition,
  NotificationTypeDefinition,
} from "../../../api/lib/notifications/registry";
import type { EnvVitNode } from "../../../api/middlewares/global.middleware";
import type { NotificationEmailMode } from "../../../lib/notifications/types";
import type { ContentSubmissionKind } from "../../approvals/const";
import type {
  AnyContentTypeDefinition,
  ContentFieldsOf,
  ContentPublicOwnershipField,
  ContentSelect,
} from "../../types";

import { buildNotificationType } from "../../../api/lib/notifications/registry";
import { ContentEngineError } from "../../errors";
import { contentNotificationAccess } from "./access";

/**
 * When a content notification rule runs.
 *
 * - `firstPublication`: the record became public for the first time - a plain
 *   publish, a scheduled publish when it fires, or the approval of a create.
 *   Once per record, ever: unpublishing, hiding, restoring and republishing
 *   never fire it again.
 * - `moderationDecision`: a moderator approved or rejected one submission.
 *   Once per submission, so each review cycle can notify again.
 * - `approvalSubmitted`: a new record or an edit started waiting in the
 *   approval queue. Once per submission, so a resubmission notifies again.
 */
export type ContentNotificationTrigger =
  | "approvalSubmitted"
  | "firstPublication"
  | "moderationDecision";

/**
 * The triggers a custom rule can use. `approvalSubmitted` - a submission
 * started waiting for a moderator - belongs to the `approvalPending` preset,
 * whose recipients come from moderator permissions.
 */
export type ContentCustomNotificationTrigger = Exclude<
  ContentNotificationTrigger,
  "approvalSubmitted"
>;

export type ContentModerationDecisionStatus = "approved" | "rejected";

/** A to-one, shared `field.user()` field of `TDefinition`. */
export type ContentNotificationUserField<TDefinition> =
  ContentPublicOwnershipField<ContentFieldsOf<TDefinition>>;

/** The records a rule sees, loaded fresh when the intent is processed. */
export interface ContentNotificationRecords<TContent, TRoot> {
  /** The record the operation changed. */
  content: ContentSelect<TContent>;
  /** The reply it answers, for a threaded content type; otherwise `null`. */
  parent: ContentSelect<TContent> | null;
  /** The record a thread hangs off, when `root` is configured; otherwise `null`. */
  root: ContentSelect<TRoot> | null;
}

/** The moderation decision a `moderationDecision` rule reacts to. */
export interface ContentModerationDecision {
  /** Who submitted the proposal. Not always the record's author. */
  authorId: null | number;
  /** Whether the submission proposed a new record or an edit. */
  kind: ContentSubmissionKind;
  /** The moderator's reason, for a rejection. */
  reason: null | string;
  reviewerId: null | number;
  status: ContentModerationDecisionStatus;
  submissionId: number;
}

/**
 * What a custom rule's callbacks receive. They run in a background worker,
 * possibly more than once for the same operation, so they must be free of side
 * effects: compute and return, never send or write.
 */
export interface ContentNotificationContext<
  TContent,
  TRoot,
> extends ContentNotificationRecords<TContent, TRoot> {
  /**
   * Who performed the operation (`null` for a system action such as a
   * scheduled publish). Captured when the operation committed.
   */
  actorId: null | number;
  /**
   * The worker's context: `c.get("db")` and the other services work, but there
   * is no signed-in user - never read `c.get("user")` here.
   */
  c: Context<EnvVitNode>;
  contentTypeId: string;
  /** Set for `moderationDecision`, `null` otherwise. */
  decision: ContentModerationDecision | null;
  trigger: ContentNotificationTrigger;
}

/** Delivery defaults a member gets before choosing. Administrators can override them in the AdminCP. */
export interface ContentNotificationDefaults {
  /** Defaults to `"none"`. Anything else also enables email for the type. */
  email?: NotificationEmailMode;
  /** Defaults to `true`. */
  inApp?: boolean;
}

interface ContentNotificationPresetBase {
  /**
   * Preferences group, 1-50 of `a-z`, `0-9`, `_`, `-`. Defaults to
   * `"content"`.
   */
  category?: string;
  defaults?: ContentNotificationDefaults;
  /**
   * Allows email even when `defaults.email` is `"none"`, so members can opt
   * in. Implied by a `defaults.email` other than `"none"`.
   */
  email?: boolean;
  /**
   * The persisted notification type id, such as `"newsroom.comment_reply"`:
   * plugin-scoped, dot-separated, at most 100 characters. Stored
   * notifications and member preferences refer to it, so never change it -
   * renaming the key in `rules` is safe, changing this is not.
   */
  id: string;
}

/**
 * New comments and replies in a thread. The root record's author hears about
 * a new top-level comment or reply in their thread; the author of the reply
 * being answered hears about the answer. A member who qualifies both ways gets
 * one notification, worded as a reply.
 */
export interface ContentThreadReplyPreset<
  TContent,
  TRoot,
> extends ContentNotificationPresetBase {
  /**
   * Merges a member's notifications for the same thread and relation into one
   * inbox item while they arrive within the window. Off by default, so each
   * comment is its own item that links to that comment.
   */
  grouping?: { windowMinutes: number };
  /**
   * API message keys, translated in the recipient's language. Titles receive
   * `{actor}` (the comment's author, or a fallback name) and `{title}`.
   */
  messages: {
    /** Shown to the root's author for a comment in their thread. */
    comment: string;
    /** One-line explanation on the preferences page. */
    description?: string;
    /** The type's name on the preferences page. */
    label: string;
    /** Shown to the author of the reply being answered. */
    reply: string;
  };
  preset: "threadReply";
  recipients: {
    /** The content type's author field: the actor, and the author of a parent reply. */
    authorField: ContentNotificationUserField<TContent>;
    /** Notify the author of the reply being answered. Defaults to `true`. */
    parentAuthor?: boolean;
    /** The root's author field. Omit it to skip the root's author. */
    rootAuthorField?: ContentNotificationUserField<TRoot>;
  };
  /**
   * The same-site path the notification opens, such as the root's page with
   * an anchor to the comment. Called when the intent is processed.
   */
  target: (records: {
    content: ContentSelect<TContent>;
    parent: ContentSelect<TContent> | null;
    root: ContentSelect<TRoot>;
  }) => string;
  /**
   * The `{title}` the messages receive. Defaults to the root's
   * `admin.titleField`.
   */
  title?: (records: {
    content: ContentSelect<TContent>;
    root: ContentSelect<TRoot>;
  }) => string;
}

/**
 * Tells the submitter of a moderated create or edit what a moderator decided.
 * Delivered whether or not the record is public, but only to the submitter.
 */
export interface ContentModerationDecisionPreset<
  TContent,
  TRoot,
> extends ContentNotificationPresetBase {
  /** Which decisions notify. Defaults to both. */
  decisions?: readonly ContentModerationDecisionStatus[];
  /**
   * API message keys. Titles receive `{title}`, `{kind}` (`create` or `edit`,
   * for an ICU `select`) and, for a rejection, `{reason}` (empty when the
   * moderator gave none).
   */
  messages: {
    approved: string;
    description?: string;
    label: string;
    rejected: string;
  };
  preset: "moderationDecision";
  /**
   * Where the notification leads, or `null` for no link. A rejected create is
   * not public, so send the submitter somewhere they can open - not to an
   * anchor that is missing from the public page.
   */
  target: (args: {
    content: ContentSelect<TContent>;
    decision: ContentModerationDecision;
    root: ContentSelect<TRoot> | null;
  }) => null | string;
  /** The `{title}` the messages receive. Defaults to the root's, then the record's, `admin.titleField`. */
  title?: (records: {
    content: ContentSelect<TContent>;
    root: ContentSelect<TRoot> | null;
  }) => string;
}

/**
 * Tells moderators that a new record or a proposed edit waits for them in the
 * Moderator CP approval queue, and links to the submission there.
 *
 * Only moderators who may decide it hear about it: those whose `can_approve`
 * for the content type covers the container the record is filed in - own and
 * role grants, the container, a subtree or all resources, and root roles,
 * exactly as the queue and the decision check them. The submitter is never
 * told about their own submission. Access is checked again on delivery and
 * whenever the inbox loads, and the item leaves every inbox once the
 * submission is decided, replaced or cancelled.
 *
 * The text names no title or body, so nothing about the content stays behind
 * in an inbox after a moderator loses access.
 */
export interface ContentApprovalPendingPreset extends ContentNotificationPresetBase {
  /**
   * Preferences group. Defaults to `"moderation"`, so moderators find it apart
   * from member notifications.
   */
  category?: string;
  /**
   * API message keys. `pending` receives `{kind}` (`create` or `edit`, for an
   * ICU `select`) and `{container}`, the name of the container the record is
   * filed in.
   */
  messages: {
    description?: string;
    label: string;
    pending: string;
  };
  preset: "approvalPending";
}

/**
 * The escape hatch: an existing notification type, published on a supported
 * trigger with your own recipients and data. Callbacks may run more than once
 * for one operation (the worker retries), so keep them side-effect free.
 *
 * Give the type `access: contentNotificationAccess({ content, policy })` and
 * spread `contentNotificationRefs(context)` into `data`, so core rechecks the
 * record at delivery, before each email and whenever the inbox loads. Without
 * that, the type's own `access` (or none) is all that applies.
 *
 * Deduplication is fixed by the trigger: once per record for
 * `firstPublication`, once per submission for `moderationDecision`.
 */
export interface ContentCustomNotificationRule<TContent, TRoot, TData> {
  /** Let the actor receive their own notification. Defaults to `false`. */
  allowSelf?: boolean;
  /** Builds `data` for the type's `schema`. Must not have side effects. */
  data: (context: ContentNotificationContext<TContent, TRoot>) => TData;
  on: ContentCustomNotificationTrigger;
  /** Candidate recipients. `null`s, duplicates and the actor are dropped. */
  recipients: (
    context: ContentNotificationContext<TContent, TRoot>,
  ) =>
    | Promise<readonly (null | number | undefined)[]>
    | readonly (null | number | undefined)[];
  /**
   * A type built with `buildNotificationType()`. It is registered for you;
   * listing it in `notificationTypes` as well is fine.
   */
  type: NotificationTypeDefinition<TData>;
}

export type ContentNotificationRuleInput<TContent, TRoot, TData = unknown> =
  | ContentApprovalPendingPreset
  | ContentCustomNotificationRule<TContent, TRoot, TData>
  | ContentModerationDecisionPreset<TContent, TRoot>
  | ContentThreadReplyPreset<TContent, TRoot>;

/** A per-recipient filter on top of a preset's built-in access policy. */
export type ContentNotificationAccessFilter = (args: {
  c: Context<EnvVitNode>;
  /** The record the notification is about. */
  contentId: string;
  /** The thread's root, when there is one. */
  rootId: null | string;
  userIds: number[];
}) => number[] | Promise<number[]>;

type ContentNotificationRow = Record<string, unknown>;

/** {@link ContentNotificationContext} as the worker builds it, before typing. */
export interface ContentNotificationRuntimeContext {
  actorId: null | number;
  c: Context<EnvVitNode>;
  content: ContentNotificationRow;
  contentTypeId: string;
  decision: ContentModerationDecision | null;
  parent: ContentNotificationRow | null;
  root: ContentNotificationRow | null;
  trigger: ContentNotificationTrigger;
}

/** One rule after {@link buildContentNotifications} has resolved it. */
export type ResolvedContentNotificationRule =
  | {
      allowSelf: boolean;
      data: (context: ContentNotificationRuntimeContext) => unknown;
      key: string;
      kind: "custom";
      on: ContentCustomNotificationTrigger;
      recipients: (
        context: ContentNotificationRuntimeContext,
      ) =>
        | Promise<readonly (null | number | undefined)[]>
        | readonly (null | number | undefined)[];
      type: AnyNotificationTypeDefinition;
    }
  | {
      authorField: string;
      key: string;
      kind: "threadReply";
      on: "firstPublication";
      parentAuthor: boolean;
      rootAuthorField: null | string;
      target: (records: {
        content: ContentNotificationRow;
        parent: ContentNotificationRow | null;
        root: ContentNotificationRow;
      }) => string;
      title?: (records: {
        content: ContentNotificationRow;
        root: ContentNotificationRow;
      }) => string;
      type: NotificationTypeDefinition<ContentThreadNotificationData>;
    }
  | {
      decisions: readonly ContentModerationDecisionStatus[];
      key: string;
      kind: "moderationDecision";
      on: "moderationDecision";
      target: (args: {
        content: ContentNotificationRow;
        decision: ContentModerationDecision;
        root: ContentNotificationRow | null;
      }) => null | string;
      title?: (records: {
        content: ContentNotificationRow;
        root: ContentNotificationRow | null;
      }) => string;
      type: NotificationTypeDefinition<ContentModerationNotificationData>;
    }
  | {
      key: string;
      kind: "approvalPending";
      on: "approvalSubmitted";
      type: NotificationTypeDefinition<ContentApprovalPendingNotificationData>;
    };

type ResolvedRule<TKind extends ResolvedContentNotificationRule["kind"]> =
  Extract<ResolvedContentNotificationRule, { kind: TKind }>;

/** What {@link buildContentNotifications} returns. Register it in `buildApiPlugin({ contentNotifications })`. */
export interface ContentNotificationsConfig<
  TContent extends AnyContentTypeDefinition = AnyContentTypeDefinition,
> {
  /** Extra per-recipient filter applied by every preset rule. */
  access?: ContentNotificationAccessFilter;
  content: TContent;
  /** The notification types the rules publish, registered with the plugin. */
  notificationTypes: AnyNotificationTypeDefinition[];
  root: AnyContentTypeDefinition | null;
  rules: ResolvedContentNotificationRule[];
}

const MAX_TEXT = 300;

/** Stored data of a `threadReply` notification. */
export interface ContentThreadNotificationData {
  contentId: string;
  contentTypeId: string;
  parentId: null | string;
  relation: "comment" | "reply";
  rootId: string;
  target: string;
  title: string;
}

/** Stored data of a `moderationDecision` notification. */
export interface ContentModerationNotificationData {
  contentId: string;
  contentTypeId: string;
  decision: ContentModerationDecisionStatus;
  kind: ContentSubmissionKind;
  reason: null | string;
  rootId: null | string;
  submissionId: number;
  target: null | string;
  title: string;
}

/** Stored data of an `approvalPending` notification. */
export interface ContentApprovalPendingNotificationData {
  /** The container's name when the notification was published. */
  container: string;
  contentId: string;
  contentTypeId: string;
  kind: ContentSubmissionKind;
  /** The thread's root, so deleting it removes the notification too. */
  rootId: null | string;
  submissionId: number;
}

/** Where an `approvalPending` notification leads: the submission in the Moderator CP. */
export const contentApprovalPendingTarget = (submissionId: number): string =>
  `/modcp/approvals/${submissionId}`;

const threadDataSchema: z.ZodType<ContentThreadNotificationData> = z.object({
  contentId: z.string().min(1).max(64),
  contentTypeId: z.string().min(1).max(100),
  parentId: z.string().min(1).max(64).nullable(),
  relation: z.enum(["comment", "reply"]),
  rootId: z.string().min(1).max(64),
  target: z.string().min(1).max(2048),
  title: z.string().max(MAX_TEXT),
});

const moderationDataSchema: z.ZodType<ContentModerationNotificationData> =
  z.object({
    contentId: z.string().min(1).max(64),
    contentTypeId: z.string().min(1).max(100),
    decision: z.enum(["approved", "rejected"]),
    kind: z.enum(["create", "edit"]),
    reason: z.string().max(2000).nullable(),
    rootId: z.string().min(1).max(64).nullable(),
    submissionId: z.number().int().positive(),
    target: z.string().min(1).max(2048).nullable(),
    title: z.string().max(MAX_TEXT),
  });

const approvalPendingDataSchema: z.ZodType<ContentApprovalPendingNotificationData> =
  z.object({
    container: z.string().max(MAX_TEXT),
    contentId: z.string().min(1).max(64),
    contentTypeId: z.string().min(1).max(100),
    kind: z.enum(["create", "edit"]),
    rootId: z.string().min(1).max(64).nullable(),
    submissionId: z.number().int().positive(),
  });

/** Cuts a value to what a notification stores. */
export const contentNotificationText = (value: unknown): string =>
  typeof value === "string" ? value.slice(0, MAX_TEXT) : "";

const userFieldIssue = (
  definition: AnyContentTypeDefinition,
  name: string,
): null | string => {
  const field = (definition.fields as Record<string, unknown>)[name] as
    | undefined
    | { kind?: string; localized?: boolean; multiple?: boolean };
  if (!field) return `"${definition.id}" has no field "${name}"`;
  if (field.kind !== "user" || field.multiple || field.localized) {
    return `"${definition.id}.${name}" must be a to-one, shared \`field.user()\``;
  }

  return null;
};

const presetDefaults = (
  preset: ContentNotificationPresetBase,
): {
  defaults: { email: NotificationEmailMode; inApp: boolean };
  email: boolean;
} => {
  const email = preset.defaults?.email ?? "none";

  return {
    defaults: { email, inApp: preset.defaults?.inApp ?? true },
    email: preset.email === true || email !== "none",
  };
};

const fail = (contentTypeId: string, message: string): never => {
  throw new ContentEngineError(`Content notifications: ${message}`, {
    contentTypeId,
  });
};

/**
 * Turns Content Engine operations into notifications through the core
 * notification system: types, preferences, AdminCP policies, inbox, email and
 * digests all come from there. Register the result in
 * `buildApiPlugin({ contentNotifications: [...] })`. Server-only.
 *
 * Each rule becomes one notification type, registered for you. When a
 * matching operation commits, a durable intent is stored in the same
 * transaction; a background worker resolves recipients, rechecks visibility
 * and publishes exactly once per operation, however often it is retried.
 *
 * Presets cover the standard cases: `threadReply` for comments and replies,
 * `moderationDecision` for approval and rejection, `approvalPending` for the
 * moderators who may approve a waiting submission. A rule with `type` is the
 * custom escape hatch.
 *
 * @throws {ContentEngineError} For an author field that is not a to-one
 * `field.user()`, a `threadReply` rule on a content type without `thread` or
 * without `root`, duplicate ids, or an empty `rules`.
 * @throws {NotificationRegistryError} For an invalid `id` or `category`.
 *
 * @example
 * ```ts
 * import { buildContentNotifications } from "@vitnode/core/content/server";
 *
 * import { articleContentType } from "@/content/article";
 * import { commentContentType } from "@/content/comment";
 *
 * export const commentNotifications = buildContentNotifications({
 *   content: commentContentType,
 *   root: articleContentType,
 *   rules: {
 *     replies: {
 *       id: "newsroom.comment_reply",
 *       preset: "threadReply",
 *       recipients: { authorField: "author", rootAuthorField: "author" },
 *       messages: {
 *         label: "newsroom.notifications.comment_reply.label",
 *         comment: "newsroom.notifications.comment_reply.comment",
 *         reply: "newsroom.notifications.comment_reply.reply",
 *       },
 *       target: ({ root, content }) =>
 *         `/news/${root.slug}#comment-${content.id}`,
 *     },
 *   },
 * });
 * ```
 */
export function buildContentNotifications<
  TContent extends AnyContentTypeDefinition,
  TRoot extends AnyContentTypeDefinition = AnyContentTypeDefinition,
  TRules extends Record<string, unknown> = Record<string, unknown>,
>(config: {
  /**
   * Narrows who may see every preset notification, on top of the built-in
   * policy - for content your plugin restricts to some members. Return the
   * allowed ids; answer the whole batch with one query.
   */
  access?: ContentNotificationAccessFilter;
  /** The content type whose operations notify. */
  content: TContent;
  /**
   * The thread's root content type (the target of `thread.root`). Required
   * for `threadReply`; optional otherwise, to load the root for targets.
   */
  root?: TRoot;
  /** Keyed for readability only - persisted ids come from each rule's `id`. */
  rules: {
    [K in keyof TRules]: ContentNotificationRuleInput<
      TContent,
      TRoot,
      TRules[K]
    >;
  };
}): ContentNotificationsConfig<TContent> {
  const { content, root = null } = config;
  const entries = Object.entries(config.rules) as [
    string,
    ContentNotificationRuleInput<TContent, TRoot>,
  ][];
  if (entries.length === 0) fail(content.id, "`rules` is empty.");

  if (root?.id === content.id) {
    fail(content.id, "`root` must be another content type.");
  }

  const seen = new Set<string>();
  const notificationTypes: AnyNotificationTypeDefinition[] = [];
  const rules: ResolvedContentNotificationRule[] = [];

  const register = (key: string, type: AnyNotificationTypeDefinition) => {
    if (seen.has(type.id)) {
      fail(
        content.id,
        `rule "${key}" reuses the notification id "${type.id}". Every rule needs its own id.`,
      );
    }
    seen.add(type.id);
    notificationTypes.push(type);
  };

  for (const [key, rule] of entries) {
    if ("type" in rule) {
      register(key, rule.type);
      rules.push({
        allowSelf: rule.allowSelf ?? false,
        data: rule.data as ResolvedRule<"custom">["data"],
        key,
        kind: "custom",
        on: rule.on,
        recipients: rule.recipients as ResolvedRule<"custom">["recipients"],
        type: rule.type,
      });
      continue;
    }

    const { defaults, email } = presetDefaults(rule);

    if (rule.preset === "approvalPending") {
      const { messages } = rule;
      const type =
        buildNotificationType<ContentApprovalPendingNotificationData>({
          access: contentNotificationAccess({
            content,
            filter: config.access,
            policy: "approval",
          }),
          category: rule.category ?? "moderation",
          defaults,
          description: messages.description,
          email,
          id: rule.id,
          label: messages.label,
          present: ({ data, t }) => ({
            target: contentApprovalPendingTarget(data.submissionId),
            title: t(messages.pending, {
              container: data.container,
              kind: data.kind,
            }),
          }),
          schema: approvalPendingDataSchema,
          subjectType: content.id,
          version: 1,
        });
      register(key, type);
      rules.push({
        key,
        kind: "approvalPending",
        on: "approvalSubmitted",
        type,
      });
      continue;
    }

    const category = rule.category ?? "content";

    if (rule.preset === "threadReply") {
      if (!content.thread.enabled) {
        fail(
          content.id,
          `rule "${key}" uses "threadReply", which needs \`thread\` on the content type.`,
        );
      }
      if (!root) {
        fail(
          content.id,
          `rule "${key}" uses "threadReply", so pass the thread's root content type as \`root\`.`,
        );
      }

      const issues = [
        userFieldIssue(content, rule.recipients.authorField),
        rule.recipients.rootAuthorField === undefined || !root
          ? null
          : userFieldIssue(root, rule.recipients.rootAuthorField),
      ].filter(issue => issue !== null);
      if (issues.length > 0) {
        fail(content.id, `rule "${key}": ${issues.join("; ")}.`);
      }

      const { messages } = rule;
      const type = buildNotificationType<ContentThreadNotificationData>({
        access: contentNotificationAccess({
          content,
          filter: config.access,
          policy: "content",
        }),
        category,
        defaults,
        description: messages.description,
        email,
        grouping: rule.grouping
          ? {
              key: ({ data }) => `${data.rootId}:${data.relation}`,
              windowMinutes: rule.grouping.windowMinutes,
            }
          : undefined,
        id: rule.id,
        label: messages.label,
        present: ({ actors, data, t }) => ({
          target: data.target,
          title: t(
            data.relation === "reply" ? messages.reply : messages.comment,
            {
              actor: actors[0]?.name ?? t("core.notifications.someone"),
              title: data.title,
            },
          ),
        }),
        schema: threadDataSchema,
        subjectType: content.id,
        version: 1,
      });
      register(key, type);
      rules.push({
        authorField: rule.recipients.authorField,
        key,
        kind: "threadReply",
        on: "firstPublication",
        parentAuthor: rule.recipients.parentAuthor ?? true,
        rootAuthorField: rule.recipients.rootAuthorField ?? null,
        target: rule.target as ResolvedRule<"threadReply">["target"],
        title: rule.title as ResolvedRule<"threadReply">["title"],
        type,
      });
      continue;
    }

    const decisions = rule.decisions ?? ["approved", "rejected"];
    if (decisions.length === 0) {
      fail(content.id, `rule "${key}" has an empty \`decisions\`.`);
    }

    const { messages } = rule;
    const type = buildNotificationType<ContentModerationNotificationData>({
      access: contentNotificationAccess({
        content,
        filter: config.access,
        policy: "submission",
      }),
      category,
      defaults,
      description: messages.description,
      email,
      id: rule.id,
      label: messages.label,
      present: ({ data, t }) => ({
        target: data.target,
        title: t(
          data.decision === "approved" ? messages.approved : messages.rejected,
          { kind: data.kind, reason: data.reason ?? "", title: data.title },
        ),
      }),
      schema: moderationDataSchema,
      subjectType: content.id,
      version: 1,
    });
    register(key, type);
    rules.push({
      decisions,
      key,
      kind: "moderationDecision",
      on: "moderationDecision",
      target: rule.target as ResolvedRule<"moderationDecision">["target"],
      title: rule.title as ResolvedRule<"moderationDecision">["title"],
      type,
    });
  }

  return {
    ...(config.access ? { access: config.access } : {}),
    content,
    notificationTypes,
    root,
    rules,
  };
}
