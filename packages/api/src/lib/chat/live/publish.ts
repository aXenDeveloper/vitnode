import type { Context } from "hono";

import type { ChatLiveServerMessage } from "./protocol";

import { readChatState } from "../read";
import { chatLiveChannel } from "./protocol";

/** Pushes one message to every user in `userIds`. No socket, no push. */
export const pushChat = (
  c: Context,
  userIds: Iterable<number>,
  data: ChatLiveServerMessage,
): void => {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  c.get("realtime").sendToUsers(
    chatLiveChannel,
    ids.map(userId => ({ data, userId })),
  );
};

/** Pushes a different message to each user. */
export const pushChatEach = (
  c: Context,
  messages: { data: ChatLiveServerMessage; userId: number }[],
): void => {
  if (messages.length === 0) return;
  c.get("realtime").sendToUsers(chatLiveChannel, messages);
};

/** Pushes each user's fresh unread counts to their open tabs. */
export const pushChatState = async (
  c: Context,
  userIds: Iterable<number>,
): Promise<void> => {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  const states = await Promise.all(
    ids.map(async userId => ({
      state: await readChatState(c, userId),
      userId,
    })),
  );
  pushChatEach(
    c,
    states.map(({ state, userId }) => ({
      data: { ...state, type: "state" },
      userId,
    })),
  );
};
