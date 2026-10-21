import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { cn } from "cn";
import React from "react";
import { useTranslations } from "use-intl";

import { DeletedUpload } from "@/components/rich-text/deleted-upload";
import { Spinner } from "@/components/ui/spinner";
import { sanitizeRichTextAlign } from "@/content/rich-text/elements";
import {
  EDITOR_IMAGE_MIN_WIDTH,
  isEditorImageWrap,
  normalizeEditorImageWidth,
} from "@/lib/editor-uploads";

import { editorUploadPreview, finishedEditorUpload } from "../uploads/flow";
import { EditorImageSettings } from "./image-settings";

const widthPercentOf = (
  figure: HTMLElement,
  startWidth: number,
  delta: number,
): number => {
  const column = figure.parentElement?.clientWidth ?? 0;
  if (column === 0) return 100;

  const percent = ((startWidth + delta) / column) * 100;

  return Math.min(100, Math.max(EDITOR_IMAGE_MIN_WIDTH, Math.round(percent)));
};

const ResizeHandle = ({
  figureRef,
  label,
  onCommit,
  onPreview,
  side,
}: {
  figureRef: React.RefObject<HTMLElement | null>;
  label: string;
  onCommit: (width: number) => void;
  onPreview: (width: null | number) => void;
  side: "end" | "start";
}) => {
  const dragRef = React.useRef<null | {
    direction: number;
    startWidth: number;
    startX: number;
    width: number;
  }>(null);

  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-background ring-border hover:bg-primary hover:ring-primary absolute top-1/2 h-10 w-1.5 -translate-y-1/2 cursor-ew-resize touch-none rounded-full opacity-0 shadow-sm ring-1 transition-[opacity,background-color] duration-150 group-hover/image:opacity-100 group-data-selected/image:opacity-100 motion-reduce:transition-none",
        side === "end" ? "end-2" : "start-2",
      )}
      draggable={false}
      onPointerCancel={() => {
        dragRef.current = null;
        onPreview(null);
      }}
      onPointerDown={event => {
        const figure = figureRef.current;
        if (!figure || event.button !== 0) return;

        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        const rtl = getComputedStyle(figure).direction === "rtl";
        const towardsEnd = side === "end" ? 1 : -1;
        const startWidth = figure.getBoundingClientRect().width;
        dragRef.current = {
          direction: rtl ? -towardsEnd : towardsEnd,
          startWidth,
          startX: event.clientX,
          width: widthPercentOf(figure, startWidth, 0),
        };
      }}
      onPointerMove={event => {
        const drag = dragRef.current;
        const figure = figureRef.current;
        if (!drag || !figure) return;

        drag.width = widthPercentOf(
          figure,
          drag.startWidth,
          (event.clientX - drag.startX) * drag.direction,
        );
        onPreview(drag.width);
      }}
      onPointerUp={() => {
        const drag = dragRef.current;
        dragRef.current = null;
        onPreview(null);
        if (drag) onCommit(drag.width);
      }}
      title={label}
    />
  );
};

export const EditorImageNodeView = ({
  deleteNode,
  editor,
  getPos,
  node,
  selected,
  updateAttributes,
}: ReactNodeViewProps) => {
  const t = useTranslations("core.global.editor.image");
  const figureRef = React.useRef<HTMLElement>(null);
  const [previewWidth, setPreviewWidth] = React.useState<null | number>(null);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  const uploadId =
    typeof node.attrs.uploadId === "string" ? node.attrs.uploadId : null;
  const storedSrc = typeof node.attrs.src === "string" ? node.attrs.src : null;
  const alt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";
  const wrap = isEditorImageWrap(node.attrs.wrap) ? node.attrs.wrap : "none";
  const width = previewWidth ?? normalizeEditorImageWidth(node.attrs.width);
  const finished = finishedEditorUpload(uploadId);
  const src = editorUploadPreview(uploadId) ?? storedSrc;
  const isUploading = uploadId !== null && finished === null;
  const isEditable = editor.isEditable;

  const commitWidth = (next: number) => {
    updateAttributes({ width: next >= 100 ? null : next });
  };

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
      as="figure"
      className="tiptap-image group/image"
      data-align={sanitizeRichTextAlign(node.attrs.textAlign) ?? undefined}
      data-drag-handle=""
      data-selected={selected || isSettingsOpen ? "" : undefined}
      data-wrap={wrap}
      ref={figureRef}
      style={width === null ? undefined : { width: `${width}%` }}
    >
      {src === null ? (
        <span className="bg-muted block aspect-video w-full rounded-md" />
      ) : (
        <img
          alt={alt}
          className={cn(isUploading && "opacity-60")}
          data-drag-image=""
          draggable={false}
          height={
            typeof node.attrs.naturalHeight === "number"
              ? node.attrs.naturalHeight
              : undefined
          }
          src={src}
          width={
            typeof node.attrs.naturalWidth === "number"
              ? node.attrs.naturalWidth
              : undefined
          }
        />
      )}

      {isUploading && (
        <span
          className="bg-background/40 absolute inset-0 flex items-center justify-center rounded-md"
          role="status"
        >
          <Spinner />
          <span className="sr-only">{t("uploading")}</span>
        </span>
      )}

      {isEditable && !isUploading && (
        <>
          <EditorImageSettings
            alt={alt}
            deleteNode={deleteNode}
            editor={editor}
            getPos={getPos}
            onOpenChange={setIsSettingsOpen}
            open={isSettingsOpen}
            updateAttributes={updateAttributes}
            width={normalizeEditorImageWidth(node.attrs.width)}
            wrap={wrap}
          />
          <ResizeHandle
            figureRef={figureRef}
            label={t("resize")}
            onCommit={commitWidth}
            onPreview={setPreviewWidth}
            side={wrap === "right" ? "start" : "end"}
          />
        </>
      )}
    </NodeViewWrapper>
  );
};
