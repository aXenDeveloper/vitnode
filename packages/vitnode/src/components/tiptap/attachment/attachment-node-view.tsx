import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import {
  ExternalLinkIcon,
  FileArchiveIcon,
  FileTextIcon,
  FileTypeIcon,
  PresentationIcon,
} from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { DeletedUpload } from "@/components/rich-text/deleted-upload";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  type EditorAttachmentKind,
  editorAttachmentKindOf,
  editorAttachmentMeta,
} from "@/lib/editor-uploads";

import { finishedEditorUpload } from "../uploads/flow";

const KIND_ICONS: Record<EditorAttachmentKind, React.ReactElement> = {
  archive: <FileArchiveIcon />,
  pdf: <FileTextIcon />,
  slides: <PresentationIcon />,
  word: <FileTypeIcon />,
};

export const EditorAttachmentKindIcon = ({
  kind,
}: {
  kind: EditorAttachmentKind;
}) => KIND_ICONS[kind];

export const EditorAttachmentNodeView = ({
  node,
  selected,
}: ReactNodeViewProps) => {
  const t = useTranslations("core.global.editor.attachment");
  const name = typeof node.attrs.name === "string" ? node.attrs.name : "";
  const size = typeof node.attrs.size === "number" ? node.attrs.size : null;
  const src = typeof node.attrs.src === "string" ? node.attrs.src : null;
  const uploadId =
    typeof node.attrs.uploadId === "string" ? node.attrs.uploadId : null;
  const isUploading =
    uploadId !== null && finishedEditorUpload(uploadId) === null;
  const kind = editorAttachmentKindOf(node.attrs.mimeType) ?? "pdf";

  if (node.attrs.deleted === true) {
    return (
      <NodeViewWrapper
        data-drag-handle=""
        data-selected={selected ? "" : undefined}
      >
        <DeletedUpload attrs={node.attrs} type={node.type.name} />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      className="tiptap-attachment group/attachment"
      data-drag-handle=""
      data-drag-image=""
      data-kind={kind}
      data-selected={selected ? "" : undefined}
    >
      <span
        aria-hidden="true"
        className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md [&_svg]:size-5"
      >
        {isUploading ? <Spinner /> : <EditorAttachmentKindIcon kind={kind} />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="tiptap-attachment-name">{name}</span>
        <span className="tiptap-attachment-meta">
          {isUploading ? t("uploading") : editorAttachmentMeta({ name, size })}
        </span>
      </span>
      {src !== null && !isUploading && (
        <Button
          aria-label={t("open", { name })}
          className="shrink-0"
          nativeButton={false}
          render={
            <a href={src} rel="noopener noreferrer nofollow" target="_blank" />
          }
          size="icon-sm"
          variant="ghost"
        >
          <ExternalLinkIcon />
        </Button>
      )}
    </NodeViewWrapper>
  );
};
