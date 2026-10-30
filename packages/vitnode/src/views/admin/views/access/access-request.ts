import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import type { ContentAccessOverrides } from "@/content/access/policy";
import type {
  ContentAccessAdminResponse,
  ContentAccessFileStatusResponse,
  ContentAccessProtectResult,
} from "@/content/access/schemas";

import { CONTENT_ACCESS_ERROR_CODES } from "@/content/access/const";
import {
  zodContentAccessAdminResponse,
  zodContentAccessFileStatus,
  zodContentAccessProtectResult,
} from "@/content/access/schemas";
import { rawFetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";
import { adminQueryRoot } from "@/views/admin/table/query";

/**
 * Where one scope family's access routes live: the admin module of a
 * container collection (`content/forum_forums`) or of a scope content type
 * (`content/categories`).
 */
export interface ContentAccessApiTarget {
  /** The family id, for query keys. */
  family: string;
  /** The admin module, without the `admin/` prefix. */
  module: string;
  pluginId: string;
}

export type ContentAccessErrorCode =
  (typeof CONTENT_ACCESS_ERROR_CODES)[number];

const errorSchema = z.object({ code: z.enum(CONTENT_ACCESS_ERROR_CODES) });

const requestArgs = (target: ContentAccessApiTarget) => ({
  module: target.module,
  pluginId: target.pluginId,
  prefixPath: "/admin",
});

const describe = (target: ContentAccessApiTarget, scopeId: string) =>
  `the access rules of ${scopeId} in ${target.family}`;

const parse = async (
  response: Response,
  screen: string,
): Promise<ContentAccessAdminResponse> => {
  if (!response.ok) throw new AdminRequestError(response.status, screen);

  const parsed = zodContentAccessAdminResponse.safeParse(await response.json());
  if (!parsed.success) {
    throw new AdminRequestError(
      response.status,
      screen,
      "the API returned a response the access editor does not describe",
    );
  }

  return parsed.data;
};

export const fetchContentAccess = async (
  target: ContentAccessApiTarget,
  scopeId: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<ContentAccessAdminResponse> =>
  await parse(
    await rawFetcher({
      ...requestArgs(target),
      method: "get",
      options: { signal },
      params: { id: scopeId },
      path: "/{id}/access",
    }),
    describe(target, scopeId),
  );

/** What the scope would look like with `overrides`, without saving them. */
export const previewContentAccess = async (
  target: ContentAccessApiTarget,
  scopeId: string,
  overrides: ContentAccessOverrides,
  { signal }: { signal?: AbortSignal } = {},
): Promise<ContentAccessAdminResponse> =>
  await parse(
    await rawFetcher({
      ...requestArgs(target),
      body: { overrides },
      method: "post",
      options: { signal },
      params: { id: scopeId },
      path: "/{id}/access/preview",
    }),
    describe(target, scopeId),
  );

export type ContentAccessSaveResult =
  | { data: ContentAccessAdminResponse }
  | { error: { code?: ContentAccessErrorCode; status: number } };

export const saveContentAccess = async (
  target: ContentAccessApiTarget,
  scopeId: string,
  overrides: ContentAccessOverrides,
): Promise<ContentAccessSaveResult> => {
  let response: Response;
  try {
    response = await rawFetcher({
      ...requestArgs(target),
      body: { overrides },
      method: "put",
      params: { id: scopeId },
      path: "/{id}/access",
    });
  } catch {
    return { error: { status: 500 } };
  }

  if (!response.ok) {
    const code = await response
      .json()
      .then(body => errorSchema.safeParse(body))
      .then(parsed => (parsed.success ? parsed.data.code : undefined))
      .catch(() => undefined);

    return { error: { code, status: response.status } };
  }

  try {
    return { data: await parse(response, describe(target, scopeId)) };
  } catch {
    return { error: { status: 500 } };
  }
};

export const contentAccessQueryRoot = (family: string) =>
  [...adminQueryRoot("access"), family] as const;

export const contentAccessQuery = (
  target: ContentAccessApiTarget,
  scopeId: string,
) =>
  queryOptions({
    queryFn: async ({ signal }) =>
      await fetchContentAccess(target, scopeId, { signal }),
    queryKey: [...contentAccessQueryRoot(target.family), scopeId],
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 0,
  });

export const contentAccessFilesQuery = (target: ContentAccessApiTarget) =>
  queryOptions({
    queryFn: async ({ signal }): Promise<ContentAccessFileStatusResponse> => {
      const response = await rawFetcher({
        ...requestArgs(target),
        method: "get",
        options: { signal },
        path: "/access/files",
      });
      const screen = `the files of ${target.family}`;
      if (!response.ok) throw new AdminRequestError(response.status, screen);
      const parsed = zodContentAccessFileStatus.safeParse(
        await response.json(),
      );
      if (!parsed.success) {
        throw new AdminRequestError(response.status, screen, "unexpected body");
      }

      return parsed.data;
    },
    queryKey: [...contentAccessQueryRoot(target.family), "files"],
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 0,
  });

/** Moves one batch of the family's public files into private storage. */
export const protectContentAccessFiles = async (
  target: ContentAccessApiTarget,
): Promise<ContentAccessProtectResult | null> => {
  try {
    const response = await rawFetcher({
      ...requestArgs(target),
      method: "post",
      path: "/access/files/protect",
    });
    if (!response.ok) return null;
    const parsed = zodContentAccessProtectResult.safeParse(
      await response.json(),
    );

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};
