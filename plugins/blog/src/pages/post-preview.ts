import type {
  ContentLivePreviewPayload,
  ContentLivePreviewReferences,
} from "@vitnode/core/content";
import type { RichTextDocument } from "@vitnode/core/content/rich-text";

import { isRichTextDocument } from "@vitnode/core/content/rich-text";
import {
  findLangValue,
  getLangValue,
  multiLangValueSchema,
} from "@vitnode/core/lib/helpers/multi-lang";
import { z } from "zod";

import { blogPostContentType } from "@/content/post";

import type { BlogArticleItem } from "./post-article";

export interface BlogPostPreviewSearch {
  locale?: string;
}

export const blogPostPreviewSearch = (
  input: Record<string, unknown>,
): BlogPostPreviewSearch =>
  typeof input.locale === "string" && input.locale !== ""
    ? { locale: input.locale }
    : {};

const DEFAULT_LOCALE = blogPostContentType.localization.defaultLocale;

const zodLangText = multiLangValueSchema();

const zodLangContent = z.array(
  z.object({
    languageCode: z.string(),
    value: z.custom<RichTextDocument>(isRichTextDocument).nullable(),
  }),
);

const localizedText = (
  value: unknown,
  locale: string,
): null | string | undefined => {
  const values = zodLangText.safeParse(value).data;
  if (!values) return undefined;

  const text =
    getLangValue(values, locale).trim() ||
    getLangValue(values, DEFAULT_LOCALE).trim();

  return text === "" ? null : text;
};

const numericIds = (value: unknown): null | number[] =>
  Array.isArray(value)
    ? value.filter((id): id is number => typeof id === "number")
    : null;

const previewAuthors = (
  value: unknown,
  saved: BlogArticleItem["authorId"],
  people: ContentLivePreviewReferences["people"],
): BlogArticleItem["authorId"] => {
  const ids = numericIds(value);
  if (!ids) return saved;

  return ids.flatMap(id => {
    const author =
      people.find(person => person.id === id) ??
      saved.find(person => person.id === id);

    return author ? [author] : [];
  });
};

const previewCoverImage = (
  value: unknown,
  saved: BlogArticleItem["coverImage"],
  files: ContentLivePreviewReferences["files"],
): BlogArticleItem["coverImage"] => {
  if (value === null) return null;
  if (typeof value !== "number") return saved;

  return (
    files.find(file => file.id === value) ??
    (saved?.id === value ? saved : null)
  );
};

export const applyBlogLivePreview = (
  item: BlogArticleItem,
  live: ContentLivePreviewPayload | null,
): BlogArticleItem => {
  if (!live) return item;

  const { locale, references, values } = live;
  const content = zodLangContent.safeParse(values.content).data;
  const coverImageAlt = localizedText(values.coverImageAlt, locale);

  return {
    ...item,
    authorId: previewAuthors(values.authorId, item.authorId, references.people),
    categoryId: numericIds(values.categoryId) ?? item.categoryId,
    content:
      findLangValue(content, locale) ??
      findLangValue(content, DEFAULT_LOCALE) ??
      item.content,
    coverImage: previewCoverImage(
      values.coverImage,
      item.coverImage,
      references.files,
    ),
    coverImageAlt:
      coverImageAlt === undefined ? item.coverImageAlt : coverImageAlt,
    title: localizedText(values.title, locale) ?? item.title,
  };
};
