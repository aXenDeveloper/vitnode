import { buildContentAdminModule, buildModule } from "@/api/builders";
import { forumContainers } from "@/content/forums";
import { commentContent } from "@/database/comments";
import { topicContent } from "@/database/topics";

export const adminModule = buildModule({
  name: "admin",
  routes: [],
  modules: [
    buildContentAdminModule({
      containers: [forumContainers],
      contentTypes: [topicContent, commentContent],
    }),
  ],
});
