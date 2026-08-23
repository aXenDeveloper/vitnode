import type { QueryClient } from "@tanstack/react-query";

import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import {
  getCurrentLocale,
  I18nProvider,
  messagesQueryOptions,
} from "@vitnode/i18n/client";

import appCss from "../styles/globals.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    // The locale comes from the request, not from a route param, so the loader
    // is what resolves it - and returning the messages hands them to the client
    // through the router's own SSR payload, with nothing to re-fetch on hydrate.
    loader: async ({ context }) => {
      const locale = getCurrentLocale();

      return {
        locale,
        messages: await context.queryClient.ensureQueryData(
          messagesQueryOptions(locale),
        ),
      };
    },
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "VitNode" },
      ],
      links: [{ rel: "stylesheet", href: appCss }],
    }),
    shellComponent: RootDocument,
  },
);

function RootDocument({ children }: { children: React.ReactNode }) {
  const initial = Route.useLoaderData();

  return (
    <html lang={initial.locale}>
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <I18nProvider initial={initial}>{children}</I18nProvider>
        <Scripts />
      </body>
    </html>
  );
}
