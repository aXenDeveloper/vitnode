import { buildContentAdminModule, buildModule } from "@/api/builders";
import { deskContainers } from "@/content/desks";
import { articleContent } from "@/database/articles";
import { bulletinContent } from "@/database/bulletins";
import { categoryContent } from "@/database/categories";
import { commentContent } from "@/database/comments";
import { eventContent } from "@/database/events";
import { explainerContent } from "@/database/explainers";
import { letterContent } from "@/database/letters";
import { pageContent } from "@/database/pages";
import { storyContent } from "@/database/stories";
import { tagContent } from "@/database/tags";

export const adminModule = buildModule({
  name: "admin",
  routes: [],
  modules: [
    buildContentAdminModule({
      containers: [deskContainers],
      // Explainers and bulletins get staff routes and permissions here, but no
      // AdminCP screen: `src/admin/nav.tsx` does not list them.
      contentTypes: [
        articleContent,
        categoryContent,
        commentContent,
        storyContent,
        explainerContent,
        bulletinContent,
        tagContent,
        eventContent,
        pageContent,
        letterContent,
      ],
    }),
  ],
});
