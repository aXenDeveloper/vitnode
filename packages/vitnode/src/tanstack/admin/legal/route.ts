import type { LegalDocumentType } from "@vitnode/api/lib/legal/contract";

import { notFound } from "@tanstack/react-router";
import { LEGAL_DOCUMENT_TYPES } from "@vitnode/api/lib/legal/contract";

import type { PluginRouteTranslator } from "@/routing";

import {
  adminLegalDraftQueryOptions,
  adminLegalOverviewQueryOptions,
  adminLegalVersionQueryOptions,
  adminLegalVersionsQueryOptions,
} from "@/views/admin/views/core/system/legal/legal-admin-query";

import type { AdminScreenContext } from "../screen";

import { requireAdminPermission } from "../screen";

export const ADMIN_LEGAL_NAMESPACES = [
  "admin.system.legal",
  "core.global",
  "core.legal",
] as const;

export const LEGAL_MODULE = "legal";

const LEGAL_VIEW = { module: LEGAL_MODULE, permission: "can_view" } as const;

type LoadContext = AdminScreenContext & { t: PluginRouteTranslator };

export interface AdminLegalRouteData {
  description: string;
  title: string;
}

export interface AdminLegalDocumentRouteData extends AdminLegalRouteData {
  documentType: LegalDocumentType;
}

export interface AdminLegalVersionRouteData extends AdminLegalDocumentRouteData {
  id: number;
}

/** A route's `:documentType` segment, or a `404`. */
export const parseLegalDocumentType = (
  value: string | undefined,
): LegalDocumentType => {
  const match = LEGAL_DOCUMENT_TYPES.find(type => type === value);
  if (!match) {
    // oxlint-disable-next-line typescript/only-throw-error
    throw notFound();
  }

  return match;
};

export const loadAdminLegalRoute = async ({
  adminAccess,
  queryClient,
  t,
}: LoadContext): Promise<AdminLegalRouteData> => {
  requireAdminPermission(adminAccess, LEGAL_VIEW);
  await queryClient.query({
    ...adminLegalOverviewQueryOptions(),
    staleTime: "static",
  });

  return {
    description: t("admin.system.legal.desc"),
    title: t("admin.system.legal.title"),
  };
};

export const loadAdminLegalDocumentRoute = async ({
  adminAccess,
  documentType,
  queryClient,
  t,
}: LoadContext & {
  documentType: LegalDocumentType;
}): Promise<AdminLegalDocumentRouteData> => {
  requireAdminPermission(adminAccess, LEGAL_VIEW);
  await Promise.all([
    queryClient.query({
      ...adminLegalDraftQueryOptions(documentType),
      staleTime: "static",
    }),
    queryClient.query({
      ...adminLegalVersionsQueryOptions(documentType),
      staleTime: "static",
    }),
  ]);

  return {
    description: t(`admin.system.legal.type_desc.${documentType}`),
    documentType,
    title: t(`admin.system.legal.types.${documentType}`),
  };
};

export const loadAdminLegalVersionRoute = async ({
  adminAccess,
  documentType,
  id,
  queryClient,
  t,
}: LoadContext & {
  documentType: LegalDocumentType;
  id: number;
}): Promise<AdminLegalVersionRouteData> => {
  requireAdminPermission(adminAccess, LEGAL_VIEW);
  const version = await queryClient
    .query({ ...adminLegalVersionQueryOptions(id), staleTime: "static" })
    .catch(() => null);
  if (version?.documentType !== documentType) {
    // oxlint-disable-next-line typescript/only-throw-error
    throw notFound();
  }

  return {
    description: t(`admin.system.legal.type_desc.${documentType}`),
    documentType,
    id,
    title: t("admin.system.legal.detail.title", {
      title: t(`admin.system.legal.types.${documentType}`),
      version: version.version,
    }),
  };
};
