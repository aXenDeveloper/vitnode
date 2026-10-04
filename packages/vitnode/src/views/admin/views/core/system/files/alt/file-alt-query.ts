import { queryOptions } from "@tanstack/react-query";

import { CONFIG_PLUGIN } from "@/config";
import { fetcherClient } from "@/lib/fetcher-client";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";
import { adminQueryRoot } from "@/views/admin/table/query";
import {
  type AdminMutationResult,
  runAdminApiMutation,
} from "@/views/admin/views/core/shared/admin-mutation";

export const FILE_ALT_POLICIES = ["automatic", "manual", "disabled"] as const;
export type FileAltPolicy = (typeof FILE_ALT_POLICIES)[number];

export interface FileAltLanguage {
  code: string;
  name: string;
  origin: "ai" | "human" | null;
  /** An AI text written for an older version of the file. */
  stale: boolean;
  /** `""` is a deliberate "no description"; `null` is nothing written yet. */
  text: null | string;
  updatedAt: Date | null | string;
}

/** `GET /admin/files/{id}/alt`. */
export interface FileAlt {
  altPolicy: FileAltPolicy;
  languages: FileAltLanguage[];
}

export type FileAltFetcher = (id: number) => Promise<FileAlt>;

export const fetchFileAlt: FileAltFetcher = async id => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    args: { params: { id } },
    method: "get",
    module: "admin/files",
    path: "/{id}/alt",
  });

  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      "a file's ALT text",
      `id=${id}`,
    );
  }

  return await response.json();
};

export const fileAltQueryRoot = adminQueryRoot("files-alt");

export const fileAltQueryKey = (id: number) =>
  [...fileAltQueryRoot, id] as const;

export const fileAltQueryOptions = (id: number) =>
  queryOptions({
    queryFn: async () => await fetchFileAlt(id),
    queryKey: fileAltQueryKey(id),
    retry: false,
    staleTime: RECORD_STALE_TIME,
  });

const ok = () => true as const;

export const saveFileAlt = async (
  id: number,
  body: { languageCode: string; text: string },
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: ok,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { body, params: { id } },
        method: "put",
        module: "admin/files",
        options: { credentials: "include" },
        path: "/{id}/alt",
      }),
  });

export const removeFileAlt = async (
  id: number,
  languageCode: string,
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: ok,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { params: { id }, query: { languageCode } },
        method: "delete",
        module: "admin/files",
        options: { credentials: "include" },
        path: "/{id}/alt",
      }),
  });

export const saveFileAltPolicy = async (
  id: number,
  altPolicy: FileAltPolicy,
): Promise<AdminMutationResult<true>> =>
  await runAdminApiMutation({
    expected: 200,
    parse: ok,
    request: async () =>
      await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        args: { body: { altPolicy }, params: { id } },
        method: "put",
        module: "admin/files",
        options: { credentials: "include" },
        path: "/{id}/alt-policy",
      }),
  });
