import { buildContentAdminModule, buildModule } from "@/api/builders";
import { blogLegacyEventListeners } from "@/api/lib/events";
import { categoryContent } from "@/database/categories";
import { commentContent } from "@/database/comments";
import { postContent } from "@/database/posts";

import { aiAdminModule } from "./ai/ai.module";

export const adminModule = buildModule({
  name: "admin",
  routes: [],
  modules: [
    aiAdminModule,
    buildContentAdminModule({
      contentTypes: [categoryContent, postContent, commentContent],
      // MCP tools, when the install turns MCP on: read and write articles
      // through the same routes the AdminCP uses, and read categories to pick
      // `categoryId`. Publishing, deleting and comments stay off MCP.
      mcp: {
        "blog.category": ["list", "detail"],
        "blog.post": [
          "list",
          "detail",
          "listTranslations",
          "showTranslation",
          "createLocalized",
          "updateLocalized",
        ],
      },
    }),
  ],
  // Event listeners are only collected from top-level modules, so the
  // compatibility adapters are registered here rather than on a nested one.
  events: blogLegacyEventListeners,
});
