import type { QueryClient } from "@tanstack/react-query";

import { redirect } from "@tanstack/react-router";

import type { PluginRouteTranslator } from "@/routing";

import {
  legalComparisonQueryOptions,
  legalLinksQueryOptions,
  legalVersionQueryOptions,
} from "@/views/legal/legal-query";

import { postAuthDestination, RETURN_TO_PARAM } from "../auth/redirects";
import { sessionQueryOptions } from "../auth/session-query";
import { LEGAL_ACCEPT_PATH } from "./gate";

export interface LegalAcceptSearch {
  returnTo?: string;
}

/** Keeps a string `returnTo`; it is sanitised before use. */
export const normalizeLegalAcceptSearch = (
  input: Record<string, unknown>,
): LegalAcceptSearch =>
  typeof input[RETURN_TO_PARAM] === "string"
    ? { returnTo: input[RETURN_TO_PARAM] }
    : {};

export interface LegalAcceptRouteData {
  lastAcceptedVersion: null | number;
  title: string;
  version: number;
  versionId: number;
}

/** Where to go once accepted: the page the member came from, never back here. */
export const legalAcceptDestination = (returnTo: unknown): string => {
  const target = postAuthDestination(returnTo);

  return target === LEGAL_ACCEPT_PATH ||
    target.startsWith(`${LEGAL_ACCEPT_PATH}?`)
    ? postAuthDestination(undefined)
    : target;
};

/**
 * Warms the acceptance page: the Terms version owed, its comparison with the
 * last one the member accepted, and the Privacy Policy link. A member who
 * owes nothing is sent on to `returnTo`.
 */
export const loadLegalAcceptRoute = async ({
  locale,
  queryClient,
  returnTo,
  t,
}: {
  locale: string;
  queryClient: QueryClient;
  returnTo?: string;
  t: PluginRouteTranslator;
}): Promise<LegalAcceptRouteData> => {
  const session = await queryClient.query(sessionQueryOptions());
  const pending = session.user?.legal.pendingTerms;
  if (!pending) {
    // oxlint-disable-next-line typescript/only-throw-error
    throw redirect({ replace: true, to: legalAcceptDestination(returnTo) });
  }

  await Promise.all([
    queryClient.query({
      ...legalVersionQueryOptions({
        documentType: "terms",
        locale,
        version: pending.version,
      }),
      staleTime: "static",
    }),
    pending.lastAcceptedVersion === null
      ? undefined
      : queryClient.query({
          ...legalComparisonQueryOptions({
            documentType: "terms",
            from: pending.lastAcceptedVersion,
            locale,
            version: pending.version,
          }),
          staleTime: "static",
        }),
    queryClient.query({
      ...legalLinksQueryOptions(locale),
      staleTime: "static",
    }),
  ]);

  return {
    lastAcceptedVersion: pending.lastAcceptedVersion,
    title:
      pending.lastAcceptedVersion === null
        ? t("core.legal.gate.title_first")
        : t("core.legal.gate.title"),
    version: pending.version,
    versionId: pending.versionId,
  };
};
