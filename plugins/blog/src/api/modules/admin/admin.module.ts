import { buildContentAdminModule, buildModule } from "@/api/builders";
import { blogLegacyEventListeners } from "@/api/lib/events";
import { categoryContent } from "@/database/categories";
import { commentContent } from "@/database/comments";
import { postContent } from "@/database/posts";

import { aiAdminModule } from "./ai/ai.admin.module";

export const adminModule = buildModule({
  name: "admin",
  routes: [],
  modules: [
    aiAdminModule,
    buildContentAdminModule({
      contentTypes: [categoryContent, postContent, commentContent],
    }),
  ],
  // Event listeners are only collected from top-level modules, so the
  // compatibility adapters are registered here rather than on a nested one.
  events: blogLegacyEventListeners,
});
