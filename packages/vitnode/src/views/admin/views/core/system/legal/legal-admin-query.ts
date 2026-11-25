import type { LegalDocumentType } from "@vitnode/api/lib/legal/contract";
import type {
  zodAdminLegalAcceptance,
  zodAdminLegalDelivery,
  zodAdminLegalDraft,
  zodAdminLegalDraftContext,
  zodAdminLegalDraftUpdate,
  zodAdminLegalOverview,
  zodAdminLegalVersion,
  zodAdminLegalVersionSummary,
} from "@vitnode/api/modules/admin/legal/legal.schema";
import type { z } from "zod";

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { manifest } from "@vitnode/api/manifest";

import { fetcherClient } from "@/lib/fetcher-client";
import {
  OPERATIONAL_STALE_TIME,
  RECORD_STALE_TIME,
} from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";
import { adminQueryRoot } from "@/views/admin/table/query";

export type AdminLegalOverview = z.infer<typeof zodAdminLegalOverview>;
export type AdminLegalVersionSummary = z.infer<
  typeof zodAdminLegalVersionSummary
>;
export type AdminLegalVersion = z.infer<typeof zodAdminLegalVersion>;
export type AdminLegalDraft = z.infer<typeof zodAdminLegalDraft>;
export type AdminLegalDraftContext = z.infer<typeof zodAdminLegalDraftContext>;
export type AdminLegalDraftUpdate = z.output<typeof zodAdminLegalDraftUpdate>;
export type AdminLegalDelivery = z.infer<typeof zodAdminLegalDelivery>;
export type AdminLegalAcceptance = z.infer<typeof zodAdminLegalAcceptance>;
export type AdminLegalDeliveryStatus = AdminLegalDelivery["status"];

export const legalAdminQueryRoot = adminQueryRoot("legal");

export const adminLegalOverviewQueryOptions = () =>
  queryOptions({
    queryFn: async (): Promise<AdminLegalOverview> => {
      const response = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "admin/legal",
        path: "/",
      });
      if (!response.ok) {
        throw new AdminRequestError(response.status, "the legal documents");
      }

      return await response.json();
    },
    queryKey: [...legalAdminQueryRoot, "overview"],
    staleTime: RECORD_STALE_TIME,
  });

export const adminLegalVersionsQueryOptions = (
  documentType: LegalDocumentType,
) =>
  queryOptions({
    queryFn: async (): Promise<{ items: AdminLegalVersionSummary[] }> => {
      const response = await fetcher({
        plugin: manifest.id,
        args: { params: { documentType } },
        method: "get",
        module: "admin/legal",
        path: "/{documentType}/versions",
      });
      if (!response.ok) {
        throw new AdminRequestError(response.status, "the legal history");
      }

      return await response.json();
    },
    queryKey: [...legalAdminQueryRoot, documentType, "versions"],
    staleTime: OPERATIONAL_STALE_TIME,
  });

export const adminLegalDraftQueryOptions = (documentType: LegalDocumentType) =>
  queryOptions({
    queryFn: async (): Promise<AdminLegalDraftContext> => {
      const response = await fetcher({
        plugin: manifest.id,
        args: { params: { documentType } },
        method: "get",
        module: "admin/legal",
        path: "/{documentType}/draft",
      });
      if (!response.ok) {
        throw new AdminRequestError(response.status, "the legal draft");
      }

      return await response.json();
    },
    queryKey: [...legalAdminQueryRoot, documentType, "draft"],
    staleTime: RECORD_STALE_TIME,
  });

export const adminLegalVersionQueryOptions = (id: number) =>
  queryOptions({
    queryFn: async (): Promise<AdminLegalVersion> => {
      const response = await fetcher({
        plugin: manifest.id,
        args: { params: { id } },
        method: "get",
        module: "admin/legal",
        path: "/versions/{id}",
      });
      if (!response.ok) {
        throw new AdminRequestError(response.status, "the legal version");
      }

      return await response.json();
    },
    queryKey: [...legalAdminQueryRoot, "version", id],
    // Delivery counts move while the announcement is sent.
    refetchInterval: query =>
      (query.state.data?.deliveries.pending ?? 0) > 0 ||
      query.state.data?.fanout?.status !== "completed"
        ? 10_000
        : false,
    staleTime: OPERATIONAL_STALE_TIME,
  });

interface DeliveriesPage {
  items: AdminLegalDelivery[];
  nextCursor: null | number;
}

interface AcceptancesPage {
  items: AdminLegalAcceptance[];
  nextCursor: null | number;
}

export const adminLegalDeliveriesQueryOptions = ({
  id,
  status,
}: {
  id: number;
  status?: AdminLegalDeliveryStatus;
}) =>
  infiniteQueryOptions({
    getNextPageParam: (last: DeliveriesPage) => last.nextCursor ?? undefined,
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }): Promise<DeliveriesPage> => {
      const response = await fetcher({
        plugin: manifest.id,
        args: {
          params: { id },
          query: { cursor: pageParam, limit: 50, status },
        },
        method: "get",
        module: "admin/legal",
        path: "/versions/{id}/deliveries",
      });
      if (!response.ok) {
        throw new AdminRequestError(response.status, "the legal deliveries");
      }

      return await response.json();
    },
    queryKey: [
      ...legalAdminQueryRoot,
      "version",
      id,
      "deliveries",
      status ?? "all",
    ],
    staleTime: OPERATIONAL_STALE_TIME,
  });

export const adminLegalAcceptancesQueryOptions = (id: number) =>
  infiniteQueryOptions({
    getNextPageParam: (last: AcceptancesPage) => last.nextCursor ?? undefined,
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }): Promise<AcceptancesPage> => {
      const response = await fetcher({
        plugin: manifest.id,
        args: { params: { id }, query: { cursor: pageParam, limit: 50 } },
        method: "get",
        module: "admin/legal",
        path: "/versions/{id}/acceptances",
      });
      if (!response.ok) {
        throw new AdminRequestError(response.status, "the legal acceptances");
      }

      return await response.json();
    },
    queryKey: [...legalAdminQueryRoot, "version", id, "acceptances"],
    staleTime: OPERATIONAL_STALE_TIME,
  });

export const adminLegalEmailPreviewQueryOptions = ({
  documentType,
  locale,
  revision,
}: {
  documentType: LegalDocumentType;
  locale: string;
  revision: number;
}) =>
  queryOptions({
    queryFn: async (): Promise<{
      html: string;
      subject: string;
      text: string;
    }> => {
      const response = await fetcherClient({
        plugin: manifest.id,
        args: { params: { documentType }, query: { locale } },
        method: "get",
        module: "admin/legal",
        path: "/{documentType}/draft/email-preview",
      });
      if (!response.ok) {
        throw new AdminRequestError(response.status, "the email preview");
      }

      return await response.json();
    },
    queryKey: [...legalAdminQueryRoot, documentType, "email", locale, revision],
  });

/** What a legal mutation answered: data, or a status with the typed `code`. */
export type LegalAdminResult<T> =
  | { code?: string; ok: false; status: number }
  | { data: T; ok: true };

const run = async <T>(
  expected: number,
  request: () => Promise<Response>,
): Promise<LegalAdminResult<T>> => {
  try {
    const response = await request();
    if (response.status === expected) {
      return { data: (await response.json()) as T, ok: true };
    }
    const body: unknown = await response.json().catch(() => null);
    const code =
      typeof body === "object" &&
      body !== null &&
      "code" in body &&
      typeof body.code === "string"
        ? body.code
        : undefined;

    return { code, ok: false, status: response.status };
  } catch {
    return { ok: false, status: 500 };
  }
};

export const createAdminLegalDraft = async (
  documentType: LegalDocumentType,
  basedOnVersionId: null | number,
) =>
  await run<AdminLegalDraft>(
    201,
    async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body: { basedOnVersionId }, params: { documentType } },
        method: "post",
        module: "admin/legal",
        path: "/{documentType}/draft",
      }),
  );

export const saveAdminLegalDraft = async (
  documentType: LegalDocumentType,
  body: AdminLegalDraftUpdate,
) =>
  await run<AdminLegalDraft>(
    200,
    async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body, params: { documentType } },
        method: "put",
        module: "admin/legal",
        path: "/{documentType}/draft",
      }),
  );

export const deleteAdminLegalDraft = async (documentType: LegalDocumentType) =>
  await run<{ ok: true }>(
    200,
    async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { params: { documentType } },
        method: "delete",
        module: "admin/legal",
        path: "/{documentType}/draft",
      }),
  );

export const publishAdminLegalDraft = async (
  documentType: LegalDocumentType,
  body: {
    effectiveAt: string;
    requiresAcceptance: boolean;
    revision: number;
  },
) =>
  await run<AdminLegalVersion>(
    201,
    async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: {
          body: { ...body, checklistConfirmed: true as const },
          params: { documentType },
        },
        method: "post",
        module: "admin/legal",
        path: "/{documentType}/publish",
      }),
  );

export const retryAdminLegalDeliveries = async (
  id: number,
  deliveryIds?: number[],
) =>
  await run<{ retried: number }>(
    200,
    async () =>
      await fetcherClient({
        plugin: manifest.id,
        args: { body: { deliveryIds }, params: { id } },
        method: "post",
        module: "admin/legal",
        path: "/versions/{id}/deliveries/retry",
      }),
  );
