import { useContentPermissions } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";

import { manifest } from "@/manifest.gen";

/** What the visitor may do with each comment on screen: `canEdit`, `canReport`. */
export const useCommentPermissions = (ids: readonly number[]) =>
  useContentPermissions({
    ids,
    queryKey: [manifest.id, "comments"],
    fetch: async request => {
      const res = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "content/comments",
        path: "/permissions",
        args: { query: { ids: request.join(",") } },
      });
      if (res.status !== 200) throw new Error("Loading permissions failed.");

      return await res.json();
    },
  });
