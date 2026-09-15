import type { QueryClient } from "@tanstack/react-query";

import { createTranslator } from "use-intl";

import type { PluginRouteTranslator } from "@/routing";

import type { PluginRouteSpec } from "./specs";

import { intlQueryOptions } from "../i18n/query";

/** What the intl query resolves to, narrowed to the half this file reads. */
interface IntlMessages {
  messages: Parameters<typeof createTranslator>[0]["messages"];
}

/**
 * The translator for a route that declared no `messages`.
 *
 * It throws rather than echoing the key back, because the alternative is a
 * `<title>` that reads `@acme/site-notes.home.title` in production - a mistake
 * nothing would surface until somebody looked at a search result.
 */
const untranslatable =
  (routeId: string): PluginRouteTranslator =>
  key => {
    throw new Error(
      `[VitNode plugin routes] Route "${routeId}" called \`t("${key}")\` but declares no \`messages\`. Add the namespace to the route in \`routes.tsx\`: page("/notes", { messages: ["${key.split(".").slice(0, -1).join(".") || "your.namespace"}"], ... }).`,
    );
  };

/**
 * A translator over the namespaces a route declared.
 *
 * Reads through the query client rather than fetching: the route's namespaces
 * are already in the cache - the loader warms them before `load` runs, and
 * `head` runs after the loader - so this resolves without a request. It is
 * `await`ed anyway because that is what makes it correct on the one path where
 * the cache is cold.
 */
export const pluginRouteTranslator = async (
  spec: PluginRouteSpec,
  { locale, queryClient }: { locale: string; queryClient: QueryClient },
): Promise<PluginRouteTranslator> => {
  if (spec.namespaces.length === 0) return untranslatable(spec.route.id);

  const intl: IntlMessages = await queryClient.query({
    ...intlQueryOptions({ locale, namespaces: spec.namespaces }),
    staleTime: "static",
  });

  const translate = createTranslator({ locale, messages: intl.messages });

  // Cast at the boundary, and only here: `createTranslator` types its keys from
  // a message tree it can see at compile time, and a plugin's tree is loaded at
  // runtime. The key is a string either way, and a missing one is use-intl's own
  // error rather than a silent blank.
  return (key, values) =>
    (translate as (key: string, values?: Record<string, unknown>) => string)(
      key,
      values,
    );
};
