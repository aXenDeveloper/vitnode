import type { EditorView } from "@tiptap/pm/view";

import {
  Fragment,
  type Node as ProseMirrorNode,
  Slice,
} from "@tiptap/pm/model";
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state";
import { Extension } from "@tiptap/react";

import { isRemoteEditorImageUrl } from "@/lib/editor-uploads";

import type { EditorUploadRuntime } from "./runtime";

import {
  EDITOR_IMAGE_NODE,
  EDITOR_UPLOAD_NODES,
  finishedEditorUpload,
  hasFinishedEditorUploads,
  insertEditorFiles,
  uploadedNodeAttrs,
} from "./flow";

export interface EditorUploadsOptions {
  getRuntime: () => EditorUploadRuntime | null;
}

const isAllowedPastedNode = (
  node: ProseMirrorNode,
  runtime: EditorUploadRuntime | null,
): boolean => {
  if (runtime === null) return false;
  if (typeof node.attrs.fileId === "number") {
    return node.type.name === EDITOR_IMAGE_NODE || runtime.attachments;
  }

  return (
    node.type.name === EDITOR_IMAGE_NODE &&
    runtime.remote &&
    typeof node.attrs.src === "string" &&
    isRemoteEditorImageUrl(node.attrs.src)
  );
};

const withoutDisallowedUploads = (
  fragment: Fragment,
  runtime: EditorUploadRuntime | null,
): Fragment => {
  const children: ProseMirrorNode[] = [];
  fragment.forEach(child => {
    if (EDITOR_UPLOAD_NODES.has(child.type.name)) {
      if (isAllowedPastedNode(child, runtime)) children.push(child);

      return;
    }

    children.push(
      child.isLeaf
        ? child
        : child.copy(withoutDisallowedUploads(child.content, runtime)),
    );
  });

  return Fragment.fromArray(children);
};

const dragImageOf = (view: EditorView): HTMLElement | null => {
  const dragged = view.state.selection;
  if (!view.dragging || !(dragged instanceof NodeSelection)) return null;
  if (!EDITOR_UPLOAD_NODES.has(dragged.node.type.name)) return null;

  const dom = view.nodeDOM(dragged.from);

  return dom instanceof HTMLElement
    ? dom.querySelector<HTMLElement>("[data-drag-image]")
    : null;
};

const filesOf = (data: DataTransfer | null): File[] =>
  data ? Array.from(data.files) : [];

const carriesStoredFile = (data: DataTransfer | null): boolean =>
  data?.getData("text/html").includes("data-file-id") ?? false;

/**
 * Turns dropped and pasted files into image and attachment nodes while
 * `getRuntime` returns a runtime, strips pasted images and attachments the
 * runtime does not allow, and swaps finished uploads back in after undo/redo.
 */
export const EditorUploads = Extension.create<EditorUploadsOptions>({
  name: "editorUploads",

  addOptions() {
    return { getRuntime: () => null };
  },

  addProseMirrorPlugins() {
    const { editor } = this;
    const { getRuntime } = this.options;

    return [
      new Plugin({
        key: new PluginKey("editorUploadDragImage"),
        view: view => {
          const onDragStart = (event: DragEvent) => {
            const image = dragImageOf(view);
            if (!image || !event.dataTransfer) return;

            const rect = image.getBoundingClientRect();
            const clamp = (value: number, max: number) =>
              Math.min(Math.max(value, 0), max);
            event.dataTransfer.setDragImage(
              image,
              clamp(event.clientX - rect.left, rect.width),
              clamp(event.clientY - rect.top, rect.height),
            );
          };
          window.addEventListener("dragstart", onDragStart);

          return {
            destroy: () => {
              window.removeEventListener("dragstart", onDragStart);
            },
          };
        },
      }),
      new Plugin({
        key: new PluginKey("editorFinishedUploads"),
        appendTransaction: (transactions, _oldState, state) => {
          if (!hasFinishedEditorUploads()) return null;
          if (!transactions.some(transaction => transaction.docChanged)) {
            return null;
          }

          const tr = state.tr;
          state.doc.descendants((node, pos) => {
            const result = finishedEditorUpload(
              typeof node.attrs.uploadId === "string"
                ? node.attrs.uploadId
                : null,
            );
            if (result) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                ...uploadedNodeAttrs(result),
              });
            }

            return !node.isAtom;
          });

          return tr.docChanged ? tr.setMeta("addToHistory", false) : null;
        },
      }),
      new Plugin({
        key: new PluginKey("editorUploadFiles"),
        props: {
          handleDrop: (view, event) => {
            const files = filesOf(event.dataTransfer);
            if (files.length === 0 || !editor.isEditable) return false;
            if (carriesStoredFile(event.dataTransfer)) return false;

            const runtime = getRuntime();
            if (runtime === null) return true;

            const pos = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            })?.pos;
            insertEditorFiles(editor, runtime, files, pos);

            return true;
          },
          handlePaste: (_view, event) => {
            const files = filesOf(event.clipboardData);
            if (files.length === 0) return false;
            if (carriesStoredFile(event.clipboardData)) return false;

            const runtime = getRuntime();
            if (runtime === null) return false;

            insertEditorFiles(editor, runtime, files);

            return true;
          },
          transformPasted: (slice, view) => {
            if (view.dragging) return slice;

            return new Slice(
              withoutDisallowedUploads(slice.content, getRuntime()),
              slice.openStart,
              slice.openEnd,
            );
          },
        },
      }),
    ];
  },
});
