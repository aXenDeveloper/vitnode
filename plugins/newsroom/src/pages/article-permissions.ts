import { useContentPermissions } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";

import { manifest } from "@/manifest.gen";

/** What the visitor may do with each article on screen: `canEdit`, `canReport`. */
export const useArticlePermissions = (ids: readonly number[]) =>
  useContentPermissions({
    ids,
    queryKey: [manifest.id, "articles"],
    fetch: async request => {
      const res = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "content/news",
        path: "/permissions",
        args: { query: { ids: request.join(",") } },
      });
      if (res.status !== 200) throw new Error("Loading permissions failed.");

      return await res.json();
    },
  });
