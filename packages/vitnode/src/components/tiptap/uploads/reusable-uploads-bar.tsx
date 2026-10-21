import type { Editor } from "@tiptap/react";

import { CopyPlusIcon } from "lucide-react";
import React from "react";
import { useLocale, useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { richTextToHtml } from "@/content/rich-text/html";
import {
  editorAttachmentKindOf,
  editorAttachmentMeta,
} from "@/lib/editor-uploads";

import type { EditorReusableUpload } from "./reuse";

import { EditorAttachmentKindIcon } from "../attachment/attachment-node-view";
import { insertReusedEditorUploads } from "./flow";
import { useEditorReusableUploads } from "./reuse";
import { useEditorUploadRuntime } from "./runtime";

const textOf = (value: unknown): string =>
  typeof value === "string" ? value : "";

const languageNames = (codes: string[], locale: string): string => {
  const names = new Intl.DisplayNames([locale], { type: "language" });

  return new Intl.ListFormat(locale, { type: "conjunction" }).format(
    codes.map(code => names.of(code) ?? code.toUpperCase()),
  );
};

const ReusableUploadItem = ({
  editor,
  upload,
}: {
  editor: Editor;
  upload: EditorReusableUpload;
}) => {
  const t = useTranslations("core.global.editor.uploads.reuse");
  const name = textOf(
    upload.type === "image" ? upload.attrs.alt : upload.attrs.name,
  );
  const meta =
    upload.type === "image"
      ? t("image")
      : editorAttachmentMeta({
          name,
          size:
            typeof upload.attrs.size === "number" ? upload.attrs.size : null,
        });
  const description = [name, meta].filter(Boolean).join(" · ");

  return (
    <TooltipWithContent text={t("insert", { name: description })}>
      <button
        aria-label={t("insert", { name: description })}
        className="bg-card hover:border-primary/50 focus-visible:border-ring focus-visible:ring-ring/50 flex h-10 shrink-0 cursor-grab items-center gap-2 overflow-hidden rounded-md border text-sm transition-[border-color] duration-150 outline-none focus-visible:ring-3 active:cursor-grabbing motion-reduce:transition-none"
        draggable
        onClick={() => {
          insertReusedEditorUploads(editor, [upload]);
        }}
        onDragStart={event => {
          event.dataTransfer.effectAllowed = "copy";
          event.dataTransfer.setData(
            "text/html",
            richTextToHtml({
              content: [{ attrs: upload.attrs, type: upload.type }],
              type: "doc",
            }),
          );
          event.dataTransfer.setData("text/plain", name);
        }}
        type="button"
      >
        {upload.type === "image" ? (
          <img
            alt=""
            className="bg-muted size-10 object-cover"
            draggable={false}
            loading="lazy"
            src={textOf(upload.attrs.src)}
          />
        ) : (
          <>
            <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center [&_svg]:size-4">
              <EditorAttachmentKindIcon
                kind={editorAttachmentKindOf(upload.attrs.mimeType) ?? "pdf"}
              />
            </span>
            <span className="max-w-40 truncate pe-3 font-medium">{name}</span>
          </>
        )}
      </button>
    </TooltipWithContent>
  );
};

/**
 * Shown under the toolbar while other language versions of the field have
 * images or files this one does not use yet. Clicking one inserts it at the
 * cursor, dragging places it; either way it is the same stored file.
 */
export const ReusableUploadsBar = ({ editor }: { editor: Editor }) => {
  const t = useTranslations("core.global.editor.uploads.reuse");
  const locale = useLocale();
  const runtime = useEditorUploadRuntime();
  const uploads = useEditorReusableUploads();
  const labelId = React.useId();

  if (!runtime || uploads.length === 0 || !editor.isEditable) return null;

  const languages = languageNames(
    [...new Set(uploads.flatMap(upload => upload.languages))],
    locale,
  );

  return (
    <div
      aria-labelledby={labelId}
      className="bg-muted/30 flex flex-col gap-2 border-b px-3 py-2 sm:flex-row sm:items-center"
      role="group"
    >
      <p
        className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs font-medium"
        id={labelId}
      >
        <CopyPlusIcon aria-hidden="true" className="size-3.5" />
        {t("from", { languages })}
      </p>
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto p-0.5">
        {uploads.map(upload => (
          <ReusableUploadItem
            editor={editor}
            key={upload.key}
            upload={upload}
          />
        ))}
      </div>
      {uploads.length > 1 && (
        <Button
          className="shrink-0 self-start sm:self-auto"
          onClick={() => {
            insertReusedEditorUploads(editor, uploads);
          }}
          size="sm"
          variant="ghost"
        >
          {t("insert_all", { count: uploads.length })}
        </Button>
      )}
    </div>
  );
};
