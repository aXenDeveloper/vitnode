import type { PluginRoutePageProps } from "@/routing";

import { ChatBreadcrumb } from "@/tanstack/chat/breadcrumb";
import { requireChatRoute } from "@/tanstack/chat/config";
import { ChatLayoutContent } from "@/tanstack/chat/screen";
import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";

const ChatLayout = ({
  children,
}: PluginRoutePageProps & { children: React.ReactNode }) => (
  <ChatLayoutContent>{children}</ChatLayoutContent>
);

export const route = defineAuthenticatedRoute({
  load: async ({ context }) => {
    await requireChatRoute(context.queryClient);
  },
  head: ({ t }) => ({
    robots: "noindex, nofollow",
    title: t("core.global.chat.title"),
  }),

  breadcrumb: ChatBreadcrumb,
});

export default ChatLayout;
