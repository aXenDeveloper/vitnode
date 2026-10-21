import { mergeAttributes, Node, ReactNodeViewRenderer } from "@tiptap/react";

import {
  sanitizeRichTextAlign,
  sanitizeRichTextSrc,
} from "@/content/rich-text/elements";
import {
  EDITOR_IMAGE_MAX_ALT_LENGTH,
  editorPositiveIntegerOf,
  isEditorImageWrap,
  normalizeEditorImageWidth,
} from "@/lib/editor-uploads";

import { EDITOR_IMAGE_NODE } from "../uploads/flow";
import { EditorImageNodeView } from "./image-node-view";

const readImageElement = (element: HTMLElement): HTMLImageElement | null =>
  element instanceof HTMLImageElement ? element : element.querySelector("img");

const hidden = () => ({});

/**
 * A block image with ALT text, a width in percent of the column and a text
 * wrap. Always registered so stored images survive editing; new ones arrive
 * only through `EditorUploads`, which the editor's `uploads` prop turns on.
 */
export const EditorImage = Node.create({
  name: EDITOR_IMAGE_NODE,
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: element =>
          sanitizeRichTextSrc(readImageElement(element)?.getAttribute("src")),
        renderHTML: hidden,
      },
      alt: {
        default: "",
        parseHTML: element =>
          (readImageElement(element)?.getAttribute("alt") ?? "").slice(
            0,
            EDITOR_IMAGE_MAX_ALT_LENGTH,
          ),
        renderHTML: hidden,
      },
      fileId: {
        default: null,
        parseHTML: element =>
          editorPositiveIntegerOf(
            readImageElement(element)?.getAttribute("data-file-id") ?? null,
          ),
        renderHTML: hidden,
      },
      naturalWidth: {
        default: null,
        parseHTML: element =>
          editorPositiveIntegerOf(
            readImageElement(element)?.getAttribute("width") ?? null,
          ),
        renderHTML: hidden,
      },
      naturalHeight: {
        default: null,
        parseHTML: element =>
          editorPositiveIntegerOf(
            readImageElement(element)?.getAttribute("height") ?? null,
          ),
        renderHTML: hidden,
      },
      width: {
        default: null,
        parseHTML: element =>
          normalizeEditorImageWidth(
            element instanceof HTMLImageElement
              ? null
              : element.style.width.replace("%", ""),
          ),
        renderHTML: hidden,
      },
      wrap: {
        default: "none",
        parseHTML: element => {
          const wrap = element.getAttribute("data-wrap");

          return isEditorImageWrap(wrap) ? wrap : "none";
        },
        renderHTML: hidden,
      },
      deleted: {
        default: false,
        parseHTML: element => element.getAttribute("data-deleted") === "true",
        renderHTML: hidden,
      },
      uploadId: {
        default: null,
        rendered: false,
      },
    };
  },

  parseHTML() {
    return [{ tag: "figure.tiptap-image" }, { tag: "img[src]" }];
  },

  renderHTML({ node }) {
    const width = normalizeEditorImageWidth(node.attrs.width);
    const wrap = isEditorImageWrap(node.attrs.wrap) ? node.attrs.wrap : "none";
    const img: Record<string, number | string> = {
      alt: typeof node.attrs.alt === "string" ? node.attrs.alt : "",
      loading: "lazy",
      ...(typeof node.attrs.src === "string" ? { src: node.attrs.src } : {}),
      ...(typeof node.attrs.fileId === "number"
        ? { "data-file-id": node.attrs.fileId }
        : {}),
      ...(typeof node.attrs.naturalWidth === "number" &&
      typeof node.attrs.naturalHeight === "number"
        ? { height: node.attrs.naturalHeight, width: node.attrs.naturalWidth }
        : {}),
    };

    const align = sanitizeRichTextAlign(node.attrs.textAlign);
    const style = [
      align === null ? "" : `text-align: ${align}`,
      width === null ? "" : `width: ${width}%`,
    ]
      .filter(Boolean)
      .join("; ");

    return [
      "figure",
      mergeAttributes(
        { class: "tiptap-image", "data-wrap": wrap },
        align === null ? {} : { "data-align": align },
        style === "" ? {} : { style },
      ),
      ["img", img],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EditorImageNodeView);
  },
});
