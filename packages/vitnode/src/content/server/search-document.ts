import type { SearchDocument } from "../../api/models/search";
import type { AnyContentTypeDefinition } from "../types";

import {
  isContentPubliclyVisible,
  isContentTranslationPubliclyVisible,
} from "../cache";
import { partitionContentFields } from "../localization";
import { readContentPath, splitContentFieldPath } from "../paths";
import { contentSearchUrl } from "../search";

/** Collapses whitespace so a multi-line value cannot break a result heading. */
const normalize = (value: unknown): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

const readSearchValue = (
  values: Record<string, unknown>,
  name: string,
): string => {
  const path = splitContentFieldPath(name);
  if (!path) return normalize(values[name]);

  const [owner, leaf] = path;
  const container = values[owner];

  if (Array.isArray(container)) {
    return (container as Record<string, unknown>[])
      .map(child => normalize(child[leaf]))
      .filter(value => value !== "")
      .join("\n");
  }

  return normalize(readContentPath(values, name));
};

const toDate = (value: unknown): Date | undefined => {
  if (value instanceof Date) return value;
  if (typeof value !== "string") return undefined;

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const toTimestamp = (value: unknown): Date | null | string | undefined => {
  if (value instanceof Date || typeof value === "string") return value;

  return value === null ? null : undefined;
};

export const isContentRowPublic = (row: object): boolean => {
  const values = row as Record<string, unknown>;

  return isContentPubliclyVisible({
    publishedAt: toTimestamp(values.publishedAt),
    status: normalize(values.status) || undefined,
  });
};

export const contentSearchDocument = (
  definition: AnyContentTypeDefinition,
  row: object,
  { locale, pluginId }: { locale?: string; pluginId?: string } = {},
): null | SearchDocument => {
  const { publicApi, search } = definition;
  if (!search.enabled) return null;

  const values = row as Record<string, unknown>;

  const itemId = values.id;
  if (typeof itemId !== "number") return null;

  if (!isContentRowPublic(row)) return null;

  const title = normalize(readSearchValue(values, search.titleField));
  if (title === "") return null;

  const url = contentSearchUrl(
    definition,
    normalize(values[publicApi.slugField]),
    locale,
  );
  if (url === null) return null;

  // A published row always carries `publishedAt`, so this resolves to the
  // publication date - which is the date the feed and the timeline sort by.
  const createdAt = toDate(values.publishedAt) ?? toDate(values.createdAt);
  if (!createdAt) return null;

  // The description leads the body so it shows up first in a result excerpt.
  // Skipped when it is already one of the content fields, so it is not indexed
  // twice and does not distort ranking.
  const sources = search.contentFields.includes(search.descriptionField ?? "")
    ? search.contentFields
    : [
        ...(search.descriptionField ? [search.descriptionField] : []),
        ...search.contentFields,
      ];

  return {
    // `SearchModel.index` strips HTML from `content` (but never from `title`,
    // which is why the title is normalized above).
    // `readSearchValue` has already collapsed the whitespace *inside* each
    // value; normalizing again here would flatten the newlines that separate
    // one repeatable child's answer from the next's into single spaces.
    content: sources
      .map(name => readSearchValue(values, name))
      .filter(value => value !== "")
      .join("\n\n"),
    createdAt,
    // Only publicly visible rows get this far, and an unpublished record is
    // deleted from the index rather than hidden in it.
    isPublic: true,
    itemId,
    // Content type ids are globally unique and already namespaced as
    // `plugin.entity`, so the id alone is a collision-free item type.
    itemType: definition.id,
    // The owning plugin, so a rebuild - which runs in the core cron request -
    // stores the same ownership a live write did.
    ...(pluginId === undefined ? {} : { pluginId }),
    // `""` for a content type that is not localized - the language-agnostic
    // value that matches every locale, and what every document written before
    // Stage 5D already carries. A localized one is indexed once per language.
    ...(locale === undefined || locale === "" ? {} : { languageCode: locale }),
    // Deliberately absent: `authorId` (a `user` field can never be public, and
    // the public search route resolves it into a person), `containerType` /
    // `containerId` (there is no `containerType` query filter to qualify them
    // with), and `metadata` (nothing reads it).
    title,
    updatedAt: toDate(values.updatedAt),
    url,
  };
};

export const contentTranslationSearchDocument = (
  definition: AnyContentTypeDefinition,
  {
    base,
    locale,
    translation,
  }: { base: object; locale: string; translation: object },
  { pluginId }: { pluginId?: string } = {},
): null | SearchDocument => {
  if (!definition.search.enabled || !definition.localization.enabled) {
    return null;
  }

  const baseValues = base as Record<string, unknown>;
  const translationValues = translation as Record<string, unknown>;

  if (
    !isContentTranslationPubliclyVisible({
      base: {
        publishedAt: toTimestamp(baseValues.publishedAt),
        status: normalize(baseValues.status) || undefined,
      },
      translation: {
        publishedAt: toTimestamp(translationValues.publishedAt),
        status: normalize(translationValues.status) || undefined,
      },
    })
  ) {
    return null;
  }

  const { localizedFields } = partitionContentFields(definition.fields);
  // The localized half wins, and only for declared localized fields: a
  // translation row also carries its own `createdAt`, `version` and publication
  // state, and letting those through would describe the translation rather than
  // the page.
  const merged: Record<string, unknown> = { ...baseValues };
  for (const name of Object.keys(localizedFields)) {
    merged[name] = translationValues[name];
  }

  // `publishedAt` decides the document's date, and this language's is the honest
  // one. The status is already known to be published on both halves.
  merged.publishedAt = translationValues.publishedAt ?? baseValues.publishedAt;
  merged.updatedAt = translationValues.updatedAt ?? baseValues.updatedAt;

  return contentSearchDocument(definition, merged, { locale, pluginId });
};
