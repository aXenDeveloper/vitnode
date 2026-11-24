import type { Context } from "hono";

import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";

import type { ContentDatabase } from "@/content/server/service";

import { core_chat_disclosures, core_chat_messages } from "@/database/chat";
import { core_users } from "@/database/users";
import { defineReportTarget } from "@/lib/moderation/targets";

import { CHAT_LIMITS } from "./const";
import { CHAT_E2E } from "./e2e";
import { chatMessagePlainText } from "./format";
import { loadMembership } from "./read";
import { pushModeratedMessage, setChatMessageHidden } from "./service";

const CONTEXT_MESSAGES = 5;

const parseMessageId = (value: string): null | string =>
  /^[1-9]\d{0,15}$/u.test(value) ? value : null;

const findMessage = async (c: Context, id: string) => {
  const [row] = await c
    .get("db")
    .select()
    .from(core_chat_messages)
    .where(eq(core_chat_messages.id, Number(id)))
    .limit(1);

  return row ?? null;
};

const namesOf = async (c: Context, ids: (null | number)[]) => {
  const unique = [...new Set(ids.filter((id): id is number => !!id))];
  if (unique.length === 0) return new Map<number, string>();
  const rows = await c
    .get("db")
    .select({ id: core_users.id, name: core_users.name })
    .from(core_users)
    .where(inArray(core_users.id, unique));

  return new Map(rows.map(row => [row.id, row.name]));
};

/**
 * The snapshot of an encrypted message: only what the reporter revealed and
 * the server checked against each message's commitment. Without a fresh
 * disclosure there is nothing to show, so the report is refused.
 */
const captureEncrypted = async (
  c: Context,
  message: typeof core_chat_messages.$inferSelect,
  reporterId: number,
) => {
  const disclosed = await c
    .get("db")
    .select({
      authorId: core_chat_messages.authorId,
      messageId: core_chat_disclosures.messageId,
      text: core_chat_disclosures.text,
    })
    .from(core_chat_disclosures)
    .innerJoin(
      core_chat_messages,
      eq(core_chat_messages.id, core_chat_disclosures.messageId),
    )
    .where(
      and(
        eq(core_chat_disclosures.reporterId, reporterId),
        eq(core_chat_disclosures.reportedMessageId, message.id),
        gte(
          core_chat_disclosures.createdAt,
          new Date(Date.now() - CHAT_E2E.disclosureTtlMinutes * 60 * 1000),
        ),
      ),
    )
    .orderBy(asc(core_chat_disclosures.messageId));
  const reported = disclosed.find(row => row.messageId === message.id);
  if (!reported) return null;
  const names = await namesOf(
    c,
    disclosed.map(row => row.authorId),
  );
  const nameOf = (id: null | number) => (id ? names.get(id) : undefined) ?? "—";
  const context = disclosed
    .filter(row => row.messageId !== message.id)
    .map(row => `${nameOf(row.authorId)}: ${row.text}`)
    .join("\n");

  return {
    authors: message.authorId
      ? [{ id: message.authorId, name: nameOf(message.authorId) }]
      : [],
    fields: [
      {
        kind: "text" as const,
        label: "core.global.chat.report.message_verified",
        name: "message",
        value: reported.text,
      },
      {
        kind: "text" as const,
        label: "core.global.chat.report.context",
        name: "context",
        value: context || null,
      },
    ],
    locale: { fallback: false, requested: null, served: null },
    scope: null,
    source: {
      publishedAt: message.createdAt.toISOString(),
      updatedAt: message.editedAt?.toISOString() ?? null,
      version: null,
    },
    title: chatMessagePlainText(reported.text, CHAT_LIMITS.previewLength),
    url: null,
  };
};

const hideAction = (hidden: boolean) => ({
  available: (state: { hidden: boolean }) => state.hidden !== hidden,
  permission: "can_hide",
  run: async (
    c: Context,
    { targetId, tx }: { targetId: string; tx: ContentDatabase },
  ) => {
    const result = await setChatMessageHidden(tx, Number(targetId), hidden);
    if (!result) return null;

    return {
      changed: result.changed,
      effects: async () => {
        await pushModeratedMessage(c, result.chatId, Number(targetId));
      },
    };
  },
});

/**
 * Chat messages members can report. Moderators see the reported message and
 * the few before it - never the rest of the chat.
 */
export const chatMessageReportTarget = defineReportTarget({
  type: "chat.message",
  label: "core.global.chat.report_target",
  permissionModule: "chat",
  parseId: parseMessageId,
  capture: async (c, { targetId }) => {
    const user = c.get("user");
    const message = await findMessage(c, targetId);
    if (!user || !message || message.kind !== "message" || message.deletedAt) {
      return null;
    }
    const membership = await loadMembership(c, message.conversationId, user.id);
    if (
      !membership ||
      message.id < membership.participant.firstVisibleMessageId ||
      message.authorId === user.id
    ) {
      return null;
    }
    if (message.encrypted) {
      return await captureEncrypted(c, message, user.id);
    }
    const before = await c
      .get("db")
      .select()
      .from(core_chat_messages)
      .where(
        and(
          eq(core_chat_messages.conversationId, message.conversationId),
          eq(core_chat_messages.kind, "message"),
          lt(core_chat_messages.id, message.id),
          gte(
            core_chat_messages.id,
            membership.participant.firstVisibleMessageId,
          ),
        ),
      )
      .orderBy(desc(core_chat_messages.id))
      .limit(CONTEXT_MESSAGES);
    const names = await namesOf(c, [
      message.authorId,
      ...before.map(row => row.authorId),
    ]);
    const nameOf = (id: null | number) =>
      (id ? names.get(id) : undefined) ?? "—";
    const context = before
      .reverse()
      .filter(row => row.body && !row.deletedAt)
      .map(row => `${nameOf(row.authorId)}: ${row.body ?? ""}`)
      .join("\n");

    return {
      authors: message.authorId
        ? [{ id: message.authorId, name: nameOf(message.authorId) }]
        : [],
      fields: [
        {
          kind: "text",
          label: "core.global.chat.report.message",
          name: "message",
          value: message.body,
        },
        {
          kind: "text",
          label: "core.global.chat.report.context",
          name: "context",
          value: context || null,
        },
      ],
      locale: { fallback: false, requested: null, served: null },
      scope: null,
      source: {
        publishedAt: message.createdAt.toISOString(),
        updatedAt: message.editedAt?.toISOString() ?? null,
        version: null,
      },
      title: message.body
        ? chatMessagePlainText(message.body, CHAT_LIMITS.previewLength)
        : null,
      url: null,
    };
  },
  current: async (c, { targetId }) => {
    const message = await findMessage(c, targetId);
    if (!message || message.deletedAt) return null;

    return { hidden: !!message.hiddenByModeratorAt, url: null };
  },
  resolveAuthors: async (c, { targetId }) => {
    const message = await findMessage(c, targetId);
    if (!message) return null;

    return {
      authorIds: message.authorId ? [message.authorId] : [],
      title:
        message.body && !message.encrypted
          ? chatMessagePlainText(message.body, CHAT_LIMITS.previewLength)
          : null,
    };
  },
  actions: { hide: hideAction(true), unhide: hideAction(false) },
});
