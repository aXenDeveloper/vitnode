import type {
  LegalAcceptanceRecord,
  LegalComparison,
  LegalDocumentOverview,
  LegalDocumentType,
  LegalLinks,
  LegalVersionDocument,
} from "@vitnode/api/lib/legal/contract";

import { queryOptions } from "@tanstack/react-query";
import { CONFIG } from "@vitnode/api/lib/config";
import { LEGAL_ERROR_CODES } from "@vitnode/api/lib/legal/contract";
import { manifest } from "@vitnode/api/manifest";

import { fetcherClient } from "@/lib/fetcher-client";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";

/** A legal read that answered with something other than `200`. */
export class LegalRequestError extends Error {
  constructor(status: number, what: string) {
    super(`The legal API answered ${status} for ${what}.`);
    this.name = "LegalRequestError";
    this.status = status;
  }

  readonly status: number;
}

export const isLegalNotFound = (error: unknown): boolean =>
  error instanceof LegalRequestError && error.status === 404;

export const LEGAL_QUERY_ROOT = ["vitnode", "legal"] as const;

/** Footer and sign-up links: the effective versions with their titles. */
export const legalLinksQueryOptions = (locale: string) =>
  queryOptions({
    queryFn: async (): Promise<LegalLinks> => {
      const response = await fetcher({
        plugin: manifest.id,
        args: { query: { locale } },
        method: "get",
        module: "legal",
        path: "/links",
      });
      if (!response.ok) throw new LegalRequestError(response.status, "links");

      return await response.json();
    },
    queryKey: [...LEGAL_QUERY_ROOT, "links", locale],
    staleTime: RECORD_STALE_TIME,
  });

/** A document type's effective version, upcoming version and history. */
export const legalDocumentQueryOptions = ({
  documentType,
  locale,
}: {
  documentType: LegalDocumentType;
  locale: string;
}) =>
  queryOptions({
    queryFn: async (): Promise<LegalDocumentOverview> => {
      const response = await fetcher({
        plugin: manifest.id,
        args: { params: { documentType }, query: { locale } },
        method: "get",
        module: "legal",
        path: "/{documentType}",
      });
      if (!response.ok) {
        throw new LegalRequestError(response.status, documentType);
      }

      return await response.json();
    },
    queryKey: [...LEGAL_QUERY_ROOT, documentType, "overview", locale],
    staleTime: RECORD_STALE_TIME,
  });

/** One announced version. */
export const legalVersionQueryOptions = ({
  documentType,
  locale,
  version,
}: {
  documentType: LegalDocumentType;
  locale: string;
  version: number;
}) =>
  queryOptions({
    queryFn: async (): Promise<LegalVersionDocument> => {
      const response = await fetcher({
        plugin: manifest.id,
        args: {
          params: { documentType, version },
          query: { locale },
        },
        method: "get",
        module: "legal",
        path: "/{documentType}/versions/{version}",
      });
      if (!response.ok) {
        throw new LegalRequestError(
          response.status,
          `${documentType} v${version}`,
        );
      }

      return await response.json();
    },
    queryKey: [...LEGAL_QUERY_ROOT, documentType, "version", version, locale],
    // Announced versions never change.
    staleTime: Infinity,
  });

/** A version compared with its predecessor, or with `from`. */
export const legalComparisonQueryOptions = ({
  documentType,
  from,
  locale,
  version,
}: {
  documentType: LegalDocumentType;
  from?: number;
  locale: string;
  version: number;
}) =>
  queryOptions({
    queryFn: async (): Promise<LegalComparison> => {
      const response = await fetcher({
        plugin: manifest.id,
        args: {
          params: { documentType, version },
          query: { from, locale },
        },
        method: "get",
        module: "legal",
        path: "/{documentType}/versions/{version}/changes",
      });
      if (!response.ok) {
        throw new LegalRequestError(
          response.status,
          `${documentType} v${version} changes`,
        );
      }

      return await response.json();
    },
    queryKey: [
      ...LEGAL_QUERY_ROOT,
      documentType,
      "changes",
      version,
      from ?? null,
      locale,
    ],
    staleTime: Infinity,
  });

/** The signed-in member's own acceptance history. Never shared or cached long. */
export const legalAcceptancesQueryOptions = (userId: number) =>
  queryOptions({
    queryFn: async (): Promise<{ items: LegalAcceptanceRecord[] }> => {
      const response = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "legal",
        path: "/me/acceptances",
      });
      if (!response.ok) {
        throw new LegalRequestError(response.status, "acceptances");
      }

      return await response.json();
    },
    queryKey: [...LEGAL_QUERY_ROOT, "acceptances", userId],
  });

/** The address of a version's downloadable HTML copy. */
export const legalDownloadHref = ({
  documentType,
  locale,
  version,
}: {
  documentType: LegalDocumentType;
  locale: string;
  version: number;
}): string =>
  new URL(
    `/api/${manifest.id}/legal/${documentType}/versions/${version}/download?locale=${encodeURIComponent(locale)}`,
    CONFIG.api.origin,
  ).toString();

export type AcceptTermsResult =
  | { kind: "accepted" }
  | { kind: "changed" }
  | { kind: "error"; status: number };

/**
 * Accepts the exact Terms version shown, in the language shown. A `409`
 * means a newer version took effect meanwhile: reload and decide again.
 */
export const acceptTerms = async ({
  locale,
  versionId,
}: {
  locale: string;
  versionId: number;
}): Promise<AcceptTermsResult> => {
  try {
    const response = await fetcherClient({
      plugin: manifest.id,
      args: { body: { locale, versionId } },
      method: "post",
      module: "legal",
      path: "/accept",
    });
    if (response.ok) return { kind: "accepted" };
    if (response.status === 409) {
      const body: unknown = await response.json().catch(() => null);
      if (
        typeof body === "object" &&
        body !== null &&
        "code" in body &&
        body.code === LEGAL_ERROR_CODES.versionChanged
      ) {
        return { kind: "changed" };
      }
    }

    return { kind: "error", status: response.status };
  } catch {
    return { kind: "error", status: 500 };
  }
};

/** Dismisses one informational notice. Records nothing else. */
export const dismissLegalNotice = async (
  versionId: number,
): Promise<boolean> => {
  try {
    const response = await fetcherClient({
      plugin: manifest.id,
      args: { params: { versionId } },
      method: "post",
      module: "legal",
      path: "/notices/{versionId}/dismiss",
    });

    return response.ok;
  } catch {
    return false;
  }
};
