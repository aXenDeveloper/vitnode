import type { PluginRoutePageProps } from "@/routing";
import type { ChatRouteSearch } from "@/tanstack/chat/screen";

import { ChatIndexContent } from "@/tanstack/chat/screen";
import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";

const ChatIndexPage = (
  _props: PluginRoutePageProps<undefined, ChatRouteSearch>,
) => <ChatIndexContent />;

export const route = defineAuthenticatedRoute<never, ChatRouteSearch>({});

export default ChatIndexPage;
