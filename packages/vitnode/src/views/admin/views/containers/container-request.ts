import { z } from "zod";

import type { ContentContainerPolicyOverrides } from "@/content/containers/policies";
import type { ContentContainerErrorCode } from "@/content/containers/types";

import { CONTENT_CONTAINER_ERROR_CODES } from "@/content/containers/const";
import {
  zodContentContainerPolicyOverrides,
  zodEffectiveContentContainerPolicy,
} from "@/content/containers/policies";
import { rawFetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";

export interface ContentContainerApiTarget {
  permissionModule: string;
  pluginId: string;
}

export const contentContainerApiTarget = ({
  definition,
  pluginId,
}: {
  definition: { admin: { permissionModule: string } };
  pluginId: string;
}): ContentContainerApiTarget => ({
  permissionModule: definition.admin.permissionModule,
  pluginId,
});

const adminContentContainerSchema = z.object({
  createdAt: z.string(),
  depth: z.number().int().positive(),
  id: z.number().int().positive(),
  metadata: z.record(z.string(), z.unknown()),
  name: z.string(),
  parentId: z.number().int().positive().nullable(),
  position: z.number().int().min(0),
  slug: z.string(),
  updatedAt: z.string(),
});

export type AdminContentContainer = z.infer<typeof adminContentContainerSchema>;

const listSchema = z.object({ items: z.array(adminContentContainerSchema) });

const errorSchema = z.object({ code: z.enum(CONTENT_CONTAINER_ERROR_CODES) });

const describe = (target: ContentContainerApiTarget) =>
  `the ${target.permissionModule} containers of ${target.pluginId}`;

const requestArgs = (target: ContentContainerApiTarget) => ({
  module: `content/${target.permissionModule}`,
  pluginId: target.pluginId,
  prefixPath: "/admin",
});

export const fetchContentContainers = async (
  target: ContentContainerApiTarget,
  { signal }: { signal?: AbortSignal } = {},
): Promise<AdminContentContainer[]> => {
  const response = await rawFetcher({
    ...requestArgs(target),
    method: "get",
    options: { signal },
    path: "/",
  });

  if (!response.ok) {
    throw new AdminRequestError(response.status, describe(target));
  }

  const parsed = listSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new AdminRequestError(
      response.status,
      describe(target),
      "the API returned a response this collection does not describe",
    );
  }

  return parsed.data.items;
};

export type ContentContainerMutationResult<T> =
  | { data: T }
  | { error: { code?: ContentContainerErrorCode; status: number } };

const readError = async (
  response: Response,
): Promise<ContentContainerErrorCode | undefined> => {
  try {
    const parsed = errorSchema.safeParse(await response.json());

    return parsed.success ? parsed.data.code : undefined;
  } catch {
    return undefined;
  }
};

const send = async (
  target: ContentContainerApiTarget,
  request: {
    body?: unknown;
    method: "delete" | "patch" | "post" | "put";
    params?: Record<string, number>;
    path: string;
  },
): Promise<ContentContainerMutationResult<null>> => {
  let response: Response;
  try {
    response = await rawFetcher({ ...requestArgs(target), ...request });
  } catch {
    return { error: { status: 500 } };
  }

  if (!response.ok) {
    return {
      error: { code: await readError(response), status: response.status },
    };
  }

  return { data: null };
};

export interface ContentContainerWriteBody {
  metadata?: Record<string, unknown>;
  name?: string;
  slug?: string;
}

export const createContentContainer = async (
  target: ContentContainerApiTarget,
  body: ContentContainerWriteBody & { name: string; parentId: null | number },
): Promise<ContentContainerMutationResult<null>> =>
  await send(target, { body, method: "post", path: "/" });

export const updateContentContainer = async (
  target: ContentContainerApiTarget,
  id: number,
  body: ContentContainerWriteBody,
): Promise<ContentContainerMutationResult<null>> =>
  await send(target, {
    body,
    method: "patch",
    params: { id },
    path: "/{id}",
  });

export const moveContentContainer = async (
  target: ContentContainerApiTarget,
  id: number,
  body: { parentId: null | number; position: number },
): Promise<ContentContainerMutationResult<null>> =>
  await send(target, {
    body,
    method: "post",
    params: { id },
    path: "/{id}/move",
  });

export const deleteContentContainer = async (
  target: ContentContainerApiTarget,
  id: number,
): Promise<ContentContainerMutationResult<null>> =>
  await send(target, {
    method: "delete",
    params: { id },
    path: "/{id}",
  });

const policySourceSchema = z.union([
  z.object({ containerId: z.number(), kind: z.literal("container") }),
  z.object({ kind: z.enum(["contentType", "default", "fallback"]) }),
]);

const policyReportSchema = z.object({
  contentTypes: z.array(
    z.object({
      contentTypeId: z.string(),
      effective: zodEffectiveContentContainerPolicy,
      inherited: zodEffectiveContentContainerPolicy,
      pluginId: z.string(),
      sources: z.record(z.string(), policySourceSchema),
    }),
  ),
  id: z.number(),
  overrides: zodContentContainerPolicyOverrides,
});

export type AdminContentContainerPolicyReport = z.infer<
  typeof policyReportSchema
>;

export type AdminContentContainerPolicySource = z.infer<
  typeof policySourceSchema
>;

export const fetchContentContainerPolicies = async (
  target: ContentContainerApiTarget,
  id: number,
  { signal }: { signal?: AbortSignal } = {},
): Promise<AdminContentContainerPolicyReport> => {
  const description = `the publishing rules of container ${String(id)} in ${describe(target)}`;
  const response = await rawFetcher({
    ...requestArgs(target),
    method: "get",
    options: { signal },
    params: { id },
    path: "/{id}/policies",
  });

  if (!response.ok) {
    throw new AdminRequestError(response.status, description);
  }

  const parsed = policyReportSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new AdminRequestError(
      response.status,
      description,
      "the API returned a response this collection does not describe",
    );
  }

  return parsed.data;
};

export const updateContentContainerPolicies = async (
  target: ContentContainerApiTarget,
  id: number,
  overrides: ContentContainerPolicyOverrides,
): Promise<ContentContainerMutationResult<null>> =>
  await send(target, {
    body: { overrides },
    method: "put",
    params: { id },
    path: "/{id}/policies",
  });
