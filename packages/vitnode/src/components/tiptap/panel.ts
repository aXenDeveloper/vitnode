import { type Editor, mergeAttributes, Node } from "@tiptap/react";

export const PANEL_KINDS = ["info", "warning", "error", "success"] as const;

export type PanelKind = (typeof PANEL_KINDS)[number];

const isPanelKind = (value: null | string): value is PanelKind =>
  PANEL_KINDS.some(kind => kind === value);

export const Panel = Node.create({
  name: "panel",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      kind: {
        default: "info",
        parseHTML: element => {
          const kind = element.getAttribute("data-panel");

          return isPanelKind(kind) ? kind : "info";
        },
        renderHTML: attributes => ({ "data-panel": attributes.kind }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-panel]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: "tiptap-panel" }),
      0,
    ];
  },
});

export const togglePanel = (editor: Editor, kind: PanelKind): boolean => {
  if (editor.isActive(Panel.name, { kind })) {
    return editor.chain().focus().lift(Panel.name).run();
  }

  if (editor.isActive(Panel.name)) {
    return editor.chain().focus().updateAttributes(Panel.name, { kind }).run();
  }

  return editor.chain().focus().wrapIn(Panel.name, { kind }).run();
};
