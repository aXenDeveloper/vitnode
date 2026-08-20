import "server-only";
import type { z } from "zod";

import { forwardApiRequestHeaders } from "@/framework/request";

import type { AnyContentTypeDefinition } from "../types";

import { rawApiFetch } from "../../lib/fetcher/raw";

export interface ContentFetchResult<TData> {
  data?: TData;
  error?: string;
  status: number;
}

/**
 * Calls a generated content route from a server component or server action.
 *
 * The generic AdminCP page does not know which plugin module it is talking to
 * at compile time, so route-literal inference buys nothing here - the response
 * is typed (and validated) by the content type's own Zod schema instead, which
 * is stricter. Everything else - URL shape, cookie and header forwarding, error
 * logging - is the same `rawApiFetch` the typed `fetcher` uses.
 */
export const contentApiFetch = async <TSchema extends z.ZodType>({
  body,
  definition,
  method,
  path = "/",
  pluginId,
  query,
  schema,
}: {
  body?: unknown;
  definition: AnyContentTypeDefinition;
  method: "delete" | "get" | "post" | "put";
  path?: string;
  pluginId: string;
  query?: Record<string, string | string[] | undefined>;
  schema?: TSchema;
}): Promise<ContentFetchResult<z.infer<TSchema>>> => {
  const response = await rawApiFetch({
    additionalHeaders: await forwardApiRequestHeaders(),
    body,
    method,
    module: `content/${definition.permissionModule}`,
    path,
    pluginId,
    prefixPath: "/admin",
    query,
  });

  if (!response.ok) {
    return { error: await response.text(), status: response.status };
  }

  const payload: unknown = await response.json();
  if (!schema)
    return { data: payload as z.infer<TSchema>, status: response.status };

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return {
      error: "The API returned a response this content type does not describe.",
      status: response.status,
    };
  }

  return { data: parsed.data, status: response.status };
};
