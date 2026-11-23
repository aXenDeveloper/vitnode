import { z } from "zod";

import { manifest } from "@/manifest";

import { defineEvent } from "../lib/event-definition";

const pluginId = manifest.id;

const chatRef = z.object({
  chatId: z.number().int(),
  kind: z.enum(["direct", "group"]),
});

/** A member started a chat. `pendingUserIds` got it as a chat request. */
export const chatCreatedEvent = defineEvent({
  pluginId,
  name: "chat.created",
  payload: chatRef.extend({
    memberIds: z.array(z.number().int()),
    pendingUserIds: z.array(z.number().int()),
    userId: z.number().int(),
  }),
});

/** A member accepted a chat request or a group invite. */
export const chatRequestAcceptedEvent = defineEvent({
  pluginId,
  name: "chat.request_accepted",
  payload: chatRef.extend({ userId: z.number().int() }),
});

/** A member ignored a chat request; `blocked` when they blocked the sender too. */
export const chatRequestIgnoredEvent = defineEvent({
  pluginId,
  name: "chat.request_ignored",
  payload: chatRef.extend({
    blocked: z.boolean(),
    userId: z.number().int(),
  }),
});

/** Members were added to a group chat. */
export const chatMemberAddedEvent = defineEvent({
  pluginId,
  name: "chat.member_added",
  payload: chatRef.extend({
    addedById: z.number().int(),
    userIds: z.array(z.number().int()),
  }),
});

/** A member left a group or the host removed them. */
export const chatMemberRemovedEvent = defineEvent({
  pluginId,
  name: "chat.member_removed",
  payload: chatRef.extend({
    reason: z.enum(["left", "removed"]),
    userId: z.number().int(),
  }),
});

const messageRef = chatRef.extend({
  authorId: z.number().int(),
  messageId: z.number().int(),
});

/** A message was sent. Carries ids only, never the text. */
export const chatMessageCreatedEvent = defineEvent({
  pluginId,
  name: "chat.message_created",
  payload: messageRef,
});

/** The author edited a message. */
export const chatMessageUpdatedEvent = defineEvent({
  pluginId,
  name: "chat.message_updated",
  payload: messageRef,
});

/** The author deleted a message. */
export const chatMessageDeletedEvent = defineEvent({
  pluginId,
  name: "chat.message_deleted",
  payload: messageRef,
});

/** A member blocked another member. */
export const userBlockedEvent = defineEvent({
  pluginId,
  name: "user.blocked",
  payload: z.object({
    blockedUserId: z.number().int(),
    userId: z.number().int(),
  }),
});

/** A member unblocked another member. */
export const userUnblockedEvent = defineEvent({
  pluginId,
  name: "user.unblocked",
  payload: z.object({
    blockedUserId: z.number().int(),
    userId: z.number().int(),
  }),
});

/** Every `chat.*` and `user.(un)blocked` event core defines. */
export const chatEventDefinitions = [
  chatCreatedEvent,
  chatRequestAcceptedEvent,
  chatRequestIgnoredEvent,
  chatMemberAddedEvent,
  chatMemberRemovedEvent,
  chatMessageCreatedEvent,
  chatMessageUpdatedEvent,
  chatMessageDeletedEvent,
  userBlockedEvent,
  userUnblockedEvent,
];
