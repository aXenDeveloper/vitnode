import { queryOptions } from "@tanstack/react-query";

import { fetcherClient } from "@/lib/fetcher-client";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { manifest } from "@/manifest";
import { fetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";
import { adminQueryRoot } from "@/views/admin/table/query";

/** The templates `ogImages` registers, as the API lists them. */
export interface AdminOgImageTemplates {
  defaultTemplate: null | string;
  /** `false` when `ogImages` is not set in `vitnode.api.config.ts`. */
  enabled: boolean;
  locales: { code: string; name: string }[];
  templates: { id: string; isDefault: boolean; version: string }[];
}

/** The temporary input one preview is drawn from. Never stored. */
export interface AdminOgImagePreviewInput {
  cover: File | null;
  description: string;
  locale: string;
  template: string;
  title: string;
}

const fetchOgImageTemplates = async (): Promise<AdminOgImageTemplates> => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "admin/seo",
    path: "/og-images",
  });

  if (!response.ok) {
    throw new AdminRequestError(response.status, "the Open Graph templates");
  }

  return await response.json();
};

export const ogImageTemplatesQueryKey = adminQueryRoot("seo-og-images");

export const ogImageTemplatesQueryOptions = () =>
  queryOptions({
    queryFn: async () => await fetchOgImageTemplates(),
    queryKey: ogImageTemplatesQueryKey,
    retry: false,
    staleTime: RECORD_STALE_TIME,
  });

/**
 * Draws one preview with the API's generator and returns the PNG. Browser-only:
 * the preview is an AdminCP interaction, and the image never leaves this tab.
 *
 * @throws `AdminRequestError` when the API refuses the input or fails to draw.
 */
export const renderOgImagePreview = async ({
  cover,
  description,
  locale,
  template,
  title,
}: AdminOgImagePreviewInput): Promise<Blob> => {
  const formData = new FormData();
  formData.append("template", template);
  formData.append("title", title);
  if (description.trim() !== "") formData.append("description", description);
  if (locale !== "") formData.append("locale", locale);
  if (cover) formData.append("cover", cover);

  const response = await fetcherClient({
    plugin: manifest.id,
    module: "admin/seo",
    path: "/og-images/preview",
    method: "post",
    formData,
    options: { cache: "no-store", credentials: "include" },
  });

  if (!response.ok) {
    throw new AdminRequestError(response.status, "the Open Graph preview");
  }

  return await response.blob();
};
