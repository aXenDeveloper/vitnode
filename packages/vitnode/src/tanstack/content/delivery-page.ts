import { notFound, redirect } from "@tanstack/react-router";

import type { PluginRouteHead } from "@/routing";

import { stripHtml } from "@/lib/strip-html";

const DESCRIPTION_MAX_LENGTH = 160;

export interface ContentDeliveryPageAlternate {
  internalPath: string;
  locale: string;
}

export interface ContentDeliveryPageMetadata {
  alternates: readonly ContentDeliveryPageAlternate[];
  canonicalInternalPath: null | string;
  locale: null | string;
  robots: null | { follow: boolean; index: boolean };
  seo: { description: null | string; title: null | string };
}

export type ContentDeliveryPageResolution =
  | (ContentDeliveryPageMetadata & { type: "content" })
  | { location: string; status: number; type: "redirect" }
  | { type: "not_found" };

export const contentPageItem = <TItem>(
  item: null | TItem | undefined,
): TItem => {
  // oxlint-disable-next-line typescript/only-throw-error
  if (item === null || item === undefined) throw notFound();

  return item;
};

export const contentDeliveryPage = <
  TResolution extends ContentDeliveryPageResolution,
  TItem,
>({
  item,
  resolution,
}: {
  item: null | TItem | undefined;
  resolution: TResolution;
}): { item: TItem; metadata: Extract<TResolution, { type: "content" }> } => {
  if (resolution.type === "redirect") {
    // oxlint-disable-next-line typescript/only-throw-error
    throw redirect({
      href: resolution.location,
      statusCode: resolution.status,
    });
  }

  // oxlint-disable-next-line typescript/only-throw-error
  if (resolution.type === "not_found") throw notFound();

  return {
    item: contentPageItem(item),
    metadata: resolution as Extract<TResolution, { type: "content" }>,
  };
};

const metaDescription = (value: null | string): string | undefined => {
  if (value === null) return undefined;

  const text = stripHtml(value);
  if (text === "") return undefined;
  if (text.length <= DESCRIPTION_MAX_LENGTH) return text;

  const cut = text.slice(0, DESCRIPTION_MAX_LENGTH - 1);
  const lastSpace = cut.lastIndexOf(" ");

  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
};

const internalAlternates = (
  metadata: ContentDeliveryPageMetadata,
): Record<string, string> | undefined => {
  const entries = metadata.alternates.map((alternate): [string, string] => [
    alternate.locale,
    alternate.internalPath,
  ]);

  if (
    entries.length === 0 &&
    metadata.locale !== null &&
    metadata.canonicalInternalPath !== null
  ) {
    entries.push([metadata.locale, metadata.canonicalInternalPath]);
  }

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

export const contentDeliveryPageHead = (
  metadata: ContentDeliveryPageMetadata | undefined,
  { title }: { title?: string } = {},
): PluginRouteHead => {
  if (metadata === undefined) return title === undefined ? {} : { title };

  const head: PluginRouteHead = {};
  const pageTitle = metadata.seo.title ?? title;
  const description = metaDescription(metadata.seo.description);
  const alternates = internalAlternates(metadata);

  if (pageTitle !== undefined) head.title = pageTitle;
  if (description !== undefined) head.description = description;
  if (alternates !== undefined) head.alternates = alternates;
  if (metadata.robots?.index === false) head.robots = "noindex, nofollow";

  return head;
};
