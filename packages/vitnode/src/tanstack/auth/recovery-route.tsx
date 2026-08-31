import type { QueryClient } from "@tanstack/react-query";

import { createTranslator } from "use-intl";

import { intlQueryOptions } from "../i18n/query";
import { passwordResetNamespaces } from "./recovery";

/** What {@link loadPasswordResetRoute} returns. */
export interface PasswordResetRouteData {
  namespaces: readonly string[];
  title: string;
}

/**
 * The strings this mode renders, warmed before it renders.
 *
 * `namespaces` is returned rather than recomputed in the component so the set
 * mounted is *literally* the set warmed - the list is part of the query key, and
 * two derivations that drifted would suspend the page.
 *
 * The deployment configuration is not fetched again: a `beforeLoad` has already
 * put it in the cache entry the component reads back.
 *
 * `core.auth.reset_password.title` is the title in **both** modes, which is what
 * the Next.js route's `generateMetadata` produces - it is page-level there and
 * cannot vary by mode. See the cast note on `translateAuthTitle`.
 */
export const loadPasswordResetRoute = async ({
  locale,
  mode,
  queryClient,
}: {
  locale: string;
  mode: "change" | "request";
  queryClient: QueryClient;
}): Promise<PasswordResetRouteData> => {
  const namespaces = passwordResetNamespaces(mode);
  const intl = await queryClient.ensureQueryData(
    intlQueryOptions({ locale, namespaces }),
  );

  const title = createTranslator({
    locale,
    messages: intl.messages as {
      core: { auth: { reset_password: { title: string } } };
    },
    namespace: "core.auth.reset_password",
  })("title");

  return { namespaces, title };
};

/**
 * The 404 for an install with no email adapter.
 *
 * `core.global` comes from a root provider, so this translates without a
 * `RouteMessages` above it - which it has to, because a `notFoundComponent`
 * renders *instead of* the component that would have mounted one.
 */
