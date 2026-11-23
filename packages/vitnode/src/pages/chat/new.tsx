import { ChatNewBreadcrumb } from "@/tanstack/chat/breadcrumb";
import { NewChatPageContent } from "@/tanstack/chat/screen";
import { defineAuthenticatedRoute } from "@/tanstack/plugin-routes";

const NewChatPage = () => <NewChatPageContent />;

export const route = defineAuthenticatedRoute({
  head: ({ t }) => ({
    robots: "noindex, nofollow",
    title: t("core.global.chat.new.title"),
  }),

  breadcrumb: ChatNewBreadcrumb,
});

export default NewChatPage;
