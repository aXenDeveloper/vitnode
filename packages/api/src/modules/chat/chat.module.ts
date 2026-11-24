import { buildModule } from "@/builders";
import { chatLiveWebSocket } from "@/lib/chat/live/socket";

import { chatCleanupCron } from "./cron/cleanup.cron";
import {
  acceptChatRoute,
  canChatRoute,
  chatStateRoute,
  ignoreChatRoute,
  listChatsRoute,
  searchPeopleRoute,
  showChatRoute,
  showChatSettingsRoute,
  startChatRoute,
  updateChatRoute,
  updateChatSettingsRoute,
} from "./routes/chats.route";
import {
  discloseMessagesRoute,
  listPublicKeysRoute,
  rewrapChatKeysRoute,
  saveOwnKeysRoute,
  showOwnKeysRoute,
} from "./routes/e2e.route";
import {
  addMembersRoute,
  addReactionRoute,
  deleteMessageRoute,
  editMessageRoute,
  listMessagesRoute,
  markReadRoute,
  removeMemberRoute,
  removeReactionRoute,
  sendMessageRoute,
} from "./routes/messages.route";
import { chatNotifyQueueTask } from "./tasks/notify.task";

export const chatModule = buildModule({
  name: "chat",
  routes: [
    chatStateRoute,
    showChatSettingsRoute,
    updateChatSettingsRoute,
    canChatRoute,
    showOwnKeysRoute,
    saveOwnKeysRoute,
    listPublicKeysRoute,
    searchPeopleRoute,
    listChatsRoute,
    startChatRoute,
    showChatRoute,
    updateChatRoute,
    acceptChatRoute,
    ignoreChatRoute,
    listMessagesRoute,
    sendMessageRoute,
    editMessageRoute,
    deleteMessageRoute,
    addReactionRoute,
    removeReactionRoute,
    markReadRoute,
    addMembersRoute,
    removeMemberRoute,
    rewrapChatKeysRoute,
    discloseMessagesRoute,
  ],
  cronJobs: [chatCleanupCron],
  queueTasks: [chatNotifyQueueTask],
  webSockets: [chatLiveWebSocket],
});
