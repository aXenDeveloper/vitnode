import type { QueryClient } from "@tanstack/react-query";

import type { PluginRouteTranslator } from "@/routing";
import type { MyFilesParams } from "@/views/files/my-files-query";

import type { MyFilesRouteSearch } from "./route-search";

import { myFilesQuery } from "./query";

export const MY_FILES_NAMESPACES = ["core.files", "core.global"] as const;

/** The narrowest slice of a route's context this loader reads. */
export interface MyFilesLoaderContext {
  auth: { user: { id: number } };
  locale: string;
  queryClient: QueryClient;
}

/** What {@link loadMyFilesRoute} returns, and therefore what `head` receives. */
export interface MyFilesRouteData {
  description: string;
  params: MyFilesParams;
  title: string;
  userId: number;
}

export const loadMyFilesRoute = async ({
  auth,
  params,
  queryClient,
  t,
}: MyFilesLoaderContext & {
  params: MyFilesParams;
  t: PluginRouteTranslator;
}): Promise<MyFilesRouteData> => {
  const userId = auth.user.id;

  await queryClient.query({
    ...myFilesQuery({ params, userId }),
    staleTime: "static",
  });

  return {
    description: t("core.files.desc"),
    params,
    title: t("core.files.title"),
    userId,
  };
};

export type MyFilesNavigate = (options: {
  resetScroll: boolean;
  search: MyFilesRouteSearch;
}) => Promise<void>;
