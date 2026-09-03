import type { QueryClient } from "@tanstack/react-query";

import { createTranslator } from "use-intl";

import { intlQueryOptions } from "../i18n/query";
import { passwordResetNamespaces } from "./recovery";

/** What {@link loadPasswordResetRoute} returns. */
export interface PasswordResetRouteData {
  namespaces: readonly string[];
  title: string;
}

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
