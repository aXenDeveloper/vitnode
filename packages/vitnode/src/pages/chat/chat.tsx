import type { PluginRoutePageProps } from "@/routing";

import { ChatPageContent } from "@/tanstack/chat/screen";
import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";

const ChatPage = ({ params }: PluginRoutePageProps) => (
  <ChatPageContent chatId={Number(params.id)} />
);

export const route = defineAuthenticatedRoute({
  head: () => ({ robots: "noindex, nofollow" }),
});

export default ChatPage;
