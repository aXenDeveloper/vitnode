import { queryOptions } from "@tanstack/react-query";

import type { OgImageTemplateSummary } from "@/og-image";

import { fetcherClient } from "@/lib/fetcher-client";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { manifest } from "@/manifest";
import { fetcher } from "@/tanstack/fetcher";
import { AdminRequestError } from "@/views/admin/admin-request";
import { adminQueryRoot } from "@/views/admin/table/query";

/** What the OG Images screen knows about the install. */
export interface AdminOgImagesOptions {
  coverMaxBytes: number;
  defaultLocale: string;
  enabled: boolean;
  height: number;
  locales: { code: string; name: string }[];
  templates: OgImageTemplateSummary[];
  width: number;
}

/** One preview request: temporary values, never stored. */
export interface AdminOgImagePreviewInput {
  cover: File | null;
  description: string;
  locale: string;
  template: string;
  title: string;
}

export const ogImagesQueryKey = adminQueryRoot("og-images");

const fetchOgImagesOptions = async (): Promise<AdminOgImagesOptions> => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "admin/seo",
    path: "/og-images",
  });

  if (!response.ok) {
    throw new AdminRequestError(response.status, "the OG images screen");
  }

  return await response.json();
};

/** The registered templates and languages, warmed by the route's loader. */
export const ogImagesQueryOptions = () =>
  queryOptions({
    queryFn: fetchOgImagesOptions,
    queryKey: ogImagesQueryKey,
    staleTime: RECORD_STALE_TIME,
  });

/**
 * Renders one preview with the API's generator and returns it as a blob.
 * Browser-only: the cover travels as `multipart/form-data` and nothing is
 * stored on the server.
 *
 * @throws {AdminRequestError} When the API answers anything but `200`, with
 * its error message as the detail.
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
  formData.append("locale", locale);
  if (description.trim() !== "") formData.append("description", description);
  if (cover) formData.append("cover", cover);

  const response = await fetcherClient({
    plugin: manifest.id,
    formData,
    method: "post",
    module: "admin/seo",
    path: "/og-images/preview",
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const detail =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : undefined;

    throw new AdminRequestError(
      response.status,
      "the OG image preview",
      detail,
    );
  }

  return await response.blob();
};
