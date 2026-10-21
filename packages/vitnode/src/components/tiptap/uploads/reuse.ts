import React from "react";

import type { RichTextAttrs, RichTextNode } from "@/content/rich-text/document";
import type { EditorUploadResult } from "@/lib/editor-uploads";
import type { MultiLangValue } from "@/lib/helpers/multi-lang";

/** An image or file already in another language version of the same field. */
export interface EditorReusableUpload {
  attrs: RichTextAttrs;
  key: string;
  languages: string[];
  type: EditorUploadResult["kind"];
}

type CollectedUploads = Map<
  string,
  Pick<EditorReusableUpload, "attrs" | "type">
>;

const isUploadType = (type: string): type is EditorReusableUpload["type"] =>
  type === "attachment" || type === "image";

const uploadKeyOf = (attrs: RichTextAttrs): null | string => {
  if (attrs.deleted === true || typeof attrs.src !== "string") return null;

  return typeof attrs.fileId === "number"
    ? `file:${attrs.fileId}`
    : `src:${attrs.src}`;
};

const collectUploads = (
  node: null | RichTextNode | undefined,
  found: CollectedUploads,
): void => {
  if (!node) return;

  if (isUploadType(node.type) && node.attrs) {
    const key = uploadKeyOf(node.attrs);
    if (key !== null && !found.has(key)) {
      found.set(key, { attrs: { ...node.attrs }, type: node.type });
    }
  }

  for (const child of node.content ?? []) collectUploads(child, found);
};

/**
 * The images and files used in the other language versions of a field that
 * the `current` language does not use yet, in document order, each listing
 * the languages it appears in.
 */
export const reusableEditorUploads = (
  versions: MultiLangValue<null | RichTextNode> | undefined,
  current: string,
): EditorReusableUpload[] => {
  const inCurrent: CollectedUploads = new Map();
  collectUploads(
    versions?.find(version => version.languageCode === current)?.value,
    inCurrent,
  );

  const reusable = new Map<string, EditorReusableUpload>();
  for (const { languageCode, value } of versions ?? []) {
    if (languageCode === current) continue;

    const found: CollectedUploads = new Map();
    collectUploads(value, found);
    for (const [key, upload] of found) {
      if (inCurrent.has(key)) continue;

      const existing = reusable.get(key);
      if (existing) existing.languages.push(languageCode);
      else reusable.set(key, { ...upload, key, languages: [languageCode] });
    }
  }

  return [...reusable.values()];
};

export const EditorReusableUploadsContext = React.createContext<
  EditorReusableUpload[]
>([]);

export const useEditorReusableUploads = (): EditorReusableUpload[] =>
  React.use(EditorReusableUploadsContext);
