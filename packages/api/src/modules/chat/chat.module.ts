import { buildModule } from "@/builders";
import { chatLiveWebSocket } from "@/lib/chat/live/socket";

import { chatCleanupCron } from "./cron/cleanup.cron";
import {
  acceptChatRoute,
  canChatRoute,
  chatStateRoute,
  ignoreChatRoute,
  listChatsRoute,
  showChatRoute,
  showChatSettingsRoute,
  startChatRoute,
  updateChatRoute,
  updateChatSettingsRoute,
} from "./routes/chats.route";
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
  ],
  cronJobs: [chatCleanupCron],
  queueTasks: [chatNotifyQueueTask],
  webSockets: [chatLiveWebSocket],
});
