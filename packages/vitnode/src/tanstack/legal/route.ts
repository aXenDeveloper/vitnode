import type { QueryClient } from "@tanstack/react-query";
import type { LegalDocumentType } from "@vitnode/api/lib/legal/contract";

import { notFound } from "@tanstack/react-router";

import type { PluginRouteTranslator } from "@/routing";

import {
  isLegalNotFound,
  legalComparisonQueryOptions,
  legalDocumentQueryOptions,
  legalVersionQueryOptions,
} from "@/views/legal/legal-query";

/** Namespaces of every public legal page and the acceptance page. */
export const LEGAL_NAMESPACES = ["core.global", "core.legal"] as const;

export interface LegalRouteContext {
  locale: string;
  queryClient: QueryClient;
  t: PluginRouteTranslator;
}

export interface LegalDocumentRouteData {
  description: string;
  documentType: LegalDocumentType;
  title: string;
}

export interface LegalVersionRouteData extends LegalDocumentRouteData {
  version: number;
}

export interface LegalChangesSearch {
  from?: number;
}

/** Keeps a positive integer `from`; drops anything else. */
export const normalizeLegalChangesSearch = (
  input: Record<string, unknown>,
): LegalChangesSearch => {
  const from = Number(input.from);

  return Number.isSafeInteger(from) && from > 0 ? { from } : {};
};

/** A route's `:version` segment as a number, or a `404`. */
export const parseLegalVersionParam = (value: string | undefined): number => {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 1) {
    // oxlint-disable-next-line typescript/only-throw-error
    throw notFound();
  }

  return version;
};

const typeTitle = (t: PluginRouteTranslator, documentType: LegalDocumentType) =>
  t(`core.legal.types.${documentType}`);

const rethrowNotFound = (error: unknown): never => {
  if (isLegalNotFound(error)) {
    // oxlint-disable-next-line typescript/only-throw-error
    throw notFound();
  }
  throw error;
};

/** Warms `/terms` or `/privacy`: the effective version and the history. */
export const loadLegalDocumentRoute = async ({
  documentType,
  locale,
  queryClient,
  t,
}: LegalRouteContext & {
  documentType: LegalDocumentType;
}): Promise<LegalDocumentRouteData> => {
  const overview = await queryClient.query({
    ...legalDocumentQueryOptions({ documentType, locale }),
    staleTime: "static",
  });

  const summary = overview.current?.summary ?? "";

  return {
    description: summary === "" ? typeTitle(t, documentType) : summary,
    documentType,
    title: overview.current?.title ?? typeTitle(t, documentType),
  };
};

/** Warms one announced version and the history around it. */
export const loadLegalVersionRoute = async ({
  documentType,
  locale,
  queryClient,
  t,
  version,
}: LegalRouteContext & {
  documentType: LegalDocumentType;
  version: number;
}): Promise<LegalVersionRouteData> => {
  const [document] = await Promise.all([
    queryClient
      .query({
        ...legalVersionQueryOptions({ documentType, locale, version }),
        staleTime: "static",
      })
      .catch(rethrowNotFound),
    queryClient.query({
      ...legalDocumentQueryOptions({ documentType, locale }),
      staleTime: "static",
    }),
  ]);

  return {
    description: document.summary || typeTitle(t, documentType),
    documentType,
    title: `${document.title} - ${t("core.legal.version", { version })}`,
    version,
  };
};

/** Warms a version's comparison with its predecessor (or `from`). */
export const loadLegalChangesRoute = async ({
  documentType,
  from,
  locale,
  queryClient,
  t,
  version,
}: LegalRouteContext & {
  documentType: LegalDocumentType;
  from?: number;
  version: number;
}): Promise<LegalVersionRouteData & { from?: number }> => {
  const comparison = await queryClient
    .query({
      ...legalComparisonQueryOptions({ documentType, from, locale, version }),
      staleTime: "static",
    })
    .catch(rethrowNotFound);
  await queryClient.query({
    ...legalDocumentQueryOptions({ documentType, locale }),
    staleTime: "static",
  });

  return {
    description: comparison.summary || typeTitle(t, documentType),
    documentType,
    from,
    title: t("core.legal.compare.title", {
      title: comparison.to.title,
      version,
    }),
    version,
  };
};
