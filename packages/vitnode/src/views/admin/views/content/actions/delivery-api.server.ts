"use server";

import { z } from "zod";

import { findFrontendContentType } from "@/content/admin/config";
import { contentApiFetch } from "@/content/admin/fetch.server";

/**
 * One address a record has answered to.
 *
 * Exactly what the admin route publishes and not one field more: the storage
 * columns behind it - `languageId`, `pluginId`, the row id - are details of
 * `core_content_slug_history`, and a panel that displayed them would make them
 * part of a contract nobody meant to sign.
 */
const zodDeliveryEntry = z.object({
  createdAt: z.coerce.date(),
  path: z.string(),
  /** `null` while this is the record's current address. */
  retiredAt: z.coerce.date().nullable(),
  slug: z.string(),
});

const zodDelivery = z.object({
  canonicalPath: z.string().nullable(),
  history: z.array(zodDeliveryEntry),
  isPublic: z.boolean(),
  locale: z.string().nullable(),
});

export type ContentDeliveryPanelData = z.infer<typeof zodDelivery>;

export interface ContentDeliveryPanelResult {
  data?: ContentDeliveryPanelData;
  error?: string;
}

/**
 * Reads one record's delivery state for the AdminCP panel.
 *
 * A Server Action rather than a fetch in the page, because the panel is lazy: it
 * loads when somebody opens the dialog, and a record's URL history is not worth a
 * query on every row of a 25-row table.
 *
 * `can_view` is enforced by the route it calls, not here - the AdminCP's session
 * cookie travels with the request and the generated route carries the permission,
 * which is the same arrangement every other content action uses. There is
 * deliberately no `can_manage_redirects`: this screen manages nothing.
 */
export const readContentDeliveryAction = async (
  contentTypeId: string,
  id: number,
  locale?: string,
): Promise<ContentDeliveryPanelResult> => {
  const entry = findFrontendContentType(contentTypeId);
  if (!entry) return { error: "Unknown content type." };

  const result = await contentApiFetch({
    definition: entry.definition,
    method: "get",
    path: `/${id}/delivery`,
    pluginId: entry.pluginId,
    query: locale === undefined ? undefined : { locale },
    schema: zodDelivery,
  });

  if (result.status !== 200 || !result.data) {
    return {
      error: result.error ?? "This record's delivery state could not be read.",
    };
  }

  return { data: result.data };
};
