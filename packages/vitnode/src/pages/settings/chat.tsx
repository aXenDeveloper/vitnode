import type { PluginRoutePageProps } from "@/routing";

import { ChatSettingsPanel } from "@/tanstack/chat/settings-screen";
import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";
import { settingsBreadcrumb } from "@/tanstack/settings/breadcrumb";

interface ChatSettingsData {
  userId: number;
}

const ChatSettingsPage = ({
  loaderData,
}: PluginRoutePageProps<ChatSettingsData>) => (
  <ChatSettingsPanel userId={loaderData.userId} />
);

export const route = defineAuthenticatedRoute<ChatSettingsData>({
  load: ({ context }) => ({ userId: context.auth.user.id }),
  head: ({ t }) => ({
    title: `${t("core.auth.settings.nav.chat")} - ${t("core.auth.settings.title")}`,
  }),

  breadcrumb: settingsBreadcrumb("chat"),
});

export default ChatSettingsPage;
