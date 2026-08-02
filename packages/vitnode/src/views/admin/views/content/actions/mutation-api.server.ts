"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { findFrontendContentType } from "@/content/admin/config";
import { contentApiFetch } from "@/content/admin/fetch.server";
import { CONTENT_OPTIONS_LIMIT } from "@/content/const";

/**
 * The generic content screen ships from core, so its cached page path is the
 * catch-all route copied into every web app.
 */
const CONTENT_PAGE_PATH =
  "/[locale]/admin/(auth)/(plugins)/(vitnode-core)/content/[...slug]";

interface MutationResult {
  error?: string;
  /** Lets the UI tell a restricted delete (409) from a generic failure. */
  status?: number;
}

const resolve = (contentTypeId: string) => {
  const entry = findFrontendContentType(contentTypeId);
  if (!entry) {
    throw new Error(`Unknown content type "${contentTypeId}".`);
  }

  return entry;
};

export const createContentAction = async (
  contentTypeId: string,
  values: Record<string, unknown>,
): Promise<MutationResult> => {
  const { definition, pluginId } = resolve(contentTypeId);

  const result = await contentApiFetch({
    body: values,
    definition,
    method: "post",
    pluginId,
  });

  if (result.status !== 201) {
    return { error: result.error ?? "", status: result.status };
  }

  revalidatePath(CONTENT_PAGE_PATH, "page");

  return {};
};

export const editContentAction = async (
  contentTypeId: string,
  id: number,
  values: Record<string, unknown>,
): Promise<MutationResult> => {
  const { definition, pluginId } = resolve(contentTypeId);

  const result = await contentApiFetch({
    body: values,
    definition,
    method: "put",
    path: `/${id}`,
    pluginId,
  });

  if (result.status !== 200) {
    return { error: result.error ?? "", status: result.status };
  }

  revalidatePath(CONTENT_PAGE_PATH, "page");

  return {};
};

export const deleteContentAction = async (
  contentTypeId: string,
  id: number,
): Promise<MutationResult> => {
  const { definition, pluginId } = resolve(contentTypeId);

  const result = await contentApiFetch({
    definition,
    method: "delete",
    path: `/${id}`,
    pluginId,
  });

  if (result.status !== 200) {
    return { error: result.error ?? "", status: result.status };
  }

  revalidatePath(CONTENT_PAGE_PATH, "page");

  return {};
};

const zodOptions = z.object({
  items: z.array(z.object({ label: z.string(), value: z.number() })),
});

/**
 * Backs the `relation` and `user` pickers.
 *
 * A server action rather than a client fetch, so the browser never needs the
 * API origin and the request is gated by the content type's own `can_view`
 * instead of a separate permission on the target table.
 */
export const loadContentOptionsAction = async (
  contentTypeId: string,
  field: string,
  search: string,
): Promise<{ label: string; value: string }[]> => {
  const { definition, pluginId } = resolve(contentTypeId);

  const result = await contentApiFetch({
    definition,
    method: "get",
    path: `/options/${field}`,
    pluginId,
    query: { search },
    schema: zodOptions,
  });

  return (result.data?.items ?? [])
    .slice(0, CONTENT_OPTIONS_LIMIT)
    .map(item => ({ label: item.label, value: String(item.value) }));
};
