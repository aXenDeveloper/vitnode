import type { z } from "zod";

import {
  parseContentConflict,
  parseContentDeliveryConflict,
  parseContentScheduleRejection,
  parseContentTranslationConflict,
  parseContentUnprocessable,
} from "@/content/conflicts";

import type { ContentMutationResult } from "../content-mutation";
import type { ContentApiRequest } from "../content-request";

import { contentApiFetchInBrowser } from "../content-request";

/** The shape `contentApiFetch` answers with on the server, read in a browser. */
export interface ContentFetchResult<TData> {
  data?: TData;
  error?: string;
  status: number;
}

/** The sentence a body that does not match the content type's schema gets. */
export const CONTENT_SCHEMA_MISMATCH =
  "The API returned a response this content type does not describe.";

export const unreachableContentResult = (
  error: unknown,
): ContentFetchResult<never> => ({
  error: error instanceof Error ? error.message : "",
  status: 500,
});

export const sendContentApiRequest = async <TSchema extends z.ZodType>(
  request: ContentApiRequest,
  schema?: TSchema,
): Promise<ContentFetchResult<z.infer<TSchema>>> => {
  let response: Response;

  try {
    response = await contentApiFetchInBrowser(request);
  } catch (error) {
    return unreachableContentResult(error);
  }

  if (!response.ok) {
    return { error: await response.text(), status: response.status };
  }

  const payload: unknown = await response.json();
  if (!schema) {
    return { data: payload as z.infer<TSchema>, status: response.status };
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return { error: CONTENT_SCHEMA_MISMATCH, status: response.status };
  }

  return { data: parsed.data, status: response.status };
};

export const contentWriteSucceeded = (
  result: { error?: string; status: number },
  status: number,
): boolean => result.status === status && result.error === undefined;

export const contentFailureResult = (result: {
  error?: string;
  status: number;
}): ContentMutationResult => ({
  conflict: parseContentConflict(result.error) ?? undefined,
  delivery: parseContentDeliveryConflict(result.error) ?? undefined,
  error: result.error ?? "",
  rejection: parseContentScheduleRejection(result.error) ?? undefined,
  status: result.status,
  translationConflict:
    parseContentTranslationConflict(result.error) ?? undefined,
  unprocessable: parseContentUnprocessable(result.error) ?? undefined,
});

export const contentVersionOf = (
  row?: Record<string, unknown>,
): number | undefined =>
  typeof row?.version === "number" ? row.version : undefined;
