import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { deLocalizeUrl, localizeUrl } from "@vitnode/i18n/client";
import { useTranslations } from "use-intl";

import { routeTree } from "./routeTree.gen";

export interface RouterAppContext {
  queryClient: QueryClient;
}

const NotFound = () => {
  const t = useTranslations("notFound");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-semibold text-balance">{t("title")}</h1>
    </main>
  );
};

export const getRouter = () => {
  const queryClient = new QueryClient();

  return createRouter({
    routeTree,
    context: { queryClient } satisfies RouterAppContext,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultNotFoundComponent: NotFound,
    // The locale lives only in the public URL: the router matches, and app code
    // links against, paths with no locale segment at all.
    rewrite: {
      input: ({ url }) => deLocalizeUrl(url),
      output: ({ url }) => localizeUrl(url),
    },
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
