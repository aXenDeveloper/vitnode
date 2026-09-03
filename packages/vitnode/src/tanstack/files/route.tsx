import type { QueryClient } from "@tanstack/react-query";

import { createTranslator } from "use-intl";

import type { MyFilesParams } from "@/views/files/my-files-query";

import type { MyFilesRouteSearch } from "./route-search";

import { intlQueryOptions } from "../i18n/query";
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
  locale,
  params,
  queryClient,
}: MyFilesLoaderContext & {
  params: MyFilesParams;
}): Promise<MyFilesRouteData> => {
  const userId = auth.user.id;

  const [intl] = await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: MY_FILES_NAMESPACES }),
    ),
    queryClient.ensureQueryData({
      ...myFilesQuery({ params, userId }),
      revalidateIfStale: true,
    }),
  ]);

  const t = createTranslator({
    locale,
    messages: intl.messages as {
      core: { files: { desc: string; title: string } };
    },
    namespace: "core.files",
  });

  return { description: t("desc"), params, title: t("title"), userId };
};

export type MyFilesNavigate = (options: {
  resetScroll: boolean;
  search: MyFilesRouteSearch;
}) => Promise<void>;
