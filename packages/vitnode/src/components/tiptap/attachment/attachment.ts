import { mergeAttributes, Node, ReactNodeViewRenderer } from "@tiptap/react";

import { sanitizeRichTextHref } from "@/content/rich-text/elements";
import {
  editorAttachmentKindOf,
  editorAttachmentMeta,
  editorPositiveIntegerOf,
} from "@/lib/editor-uploads";

import { EDITOR_ATTACHMENT_NODE } from "../uploads/flow";
import { EditorAttachmentNodeView } from "./attachment-node-view";

const hidden = () => ({});

/**
 * A downloadable file card: PDF, Word, PowerPoint or ZIP. Always registered
 * so stored attachments survive editing; new ones arrive only through
 * `EditorUploads` in an editor whose `uploads` allow `files`.
 */
export const EditorAttachment = Node.create({
  name: EDITOR_ATTACHMENT_NODE,
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: element =>
          sanitizeRichTextHref(element.getAttribute("href")),
        renderHTML: hidden,
      },
      name: {
        default: "",
        parseHTML: element =>
          element.querySelector(".tiptap-attachment-name")?.textContent ?? "",
        renderHTML: hidden,
      },
      mimeType: {
        default: null,
        parseHTML: element => element.getAttribute("type"),
        renderHTML: hidden,
      },
      size: {
        default: null,
        parseHTML: element =>
          editorPositiveIntegerOf(element.getAttribute("data-size")),
        renderHTML: hidden,
      },
      fileId: {
        default: null,
        parseHTML: element =>
          editorPositiveIntegerOf(element.getAttribute("data-file-id")),
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
    return [{ priority: 100, tag: "a.tiptap-attachment" }];
  },

  renderHTML({ node }) {
    const name = typeof node.attrs.name === "string" ? node.attrs.name : "";
    const size = typeof node.attrs.size === "number" ? node.attrs.size : null;
    const mimeType =
      typeof node.attrs.mimeType === "string" ? node.attrs.mimeType : null;

    return [
      "a",
      mergeAttributes({
        class: "tiptap-attachment",
        "data-kind": editorAttachmentKindOf(mimeType) ?? "file",
        rel: "noopener noreferrer nofollow",
        target: "_blank",
        ...(typeof node.attrs.src === "string" ? { href: node.attrs.src } : {}),
        ...(typeof node.attrs.fileId === "number"
          ? { "data-file-id": node.attrs.fileId }
          : {}),
        ...(size === null ? {} : { "data-size": size }),
        ...(mimeType === null ? {} : { type: mimeType }),
      }),
      ["span", { class: "tiptap-attachment-name" }, name],
      [
        "span",
        { class: "tiptap-attachment-meta" },
        editorAttachmentMeta({ name, size }),
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EditorAttachmentNodeView);
  },
});
