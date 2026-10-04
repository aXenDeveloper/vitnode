import type { Editor, JSONContent } from "@tiptap/react";

/** Mirrors the server's bounds (`QUICK_ASK_LIMITS`): nothing larger is sent. */
export const QUICK_ASK_CLIENT_LIMITS = {
  context: 1_500,
  selection: 8_000,
} as const;

export interface QuickAskSnapshot {
  after: string;
  before: string;
  from: number;
  selection: string;
  to: number;
}

/**
 * What Quick Ask sends: the selection and a bounded slice of text around it -
 * never the whole document.
 */
export const takeQuickAskSnapshot = (editor: Editor): QuickAskSnapshot => {
  const { doc, selection } = editor.state;
  const { from, to } = selection;
  const before = doc.textBetween(0, from, "\n", " ");
  const after = doc.textBetween(to, doc.content.size, "\n", " ");

  return {
    after: after.slice(0, QUICK_ASK_CLIENT_LIMITS.context),
    before: before.slice(-QUICK_ASK_CLIENT_LIMITS.context),
    from,
    selection: doc
      .textBetween(from, to, "\n", " ")
      .slice(0, QUICK_ASK_CLIENT_LIMITS.selection),
    to,
  };
};

/**
 * Whether the text the request was made from is still in place. A suggestion
 * for text that changed - or moved - must not replace it blindly.
 */
export const isQuickAskStale = (
  editor: Editor,
  snapshot: Pick<QuickAskSnapshot, "from" | "selection" | "to">,
): boolean => {
  const { doc } = editor.state;
  if (snapshot.to > doc.content.size) return true;

  return (
    doc.textBetween(snapshot.from, snapshot.to, "\n", " ") !==
    snapshot.selection
  );
};

/**
 * Model output as document nodes, built from plain text only: paragraphs on
 * blank lines, hard breaks on single ones. The output is never parsed as
 * HTML, so it cannot inject markup, links or scripts into the document.
 */
export const quickAskTextToNodes = (text: string): JSONContent[] =>
  text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .map(paragraph => ({
      content: paragraph
        .split("\n")
        .flatMap((line, index): JSONContent[] => [
          ...(index > 0 ? [{ type: "hardBreak" }] : []),
          ...(line ? [{ text: line, type: "text" }] : []),
        ]),
      type: "paragraph",
    }));

/**
 * Applies a suggestion in one transaction, so a single Undo restores the
 * text exactly as it was.
 */
export const applyQuickAskResult = (
  editor: Editor,
  {
    from,
    mode,
    text,
    to,
  }: { from: number; mode: "below" | "replace"; text: string; to: number },
): boolean => {
  const nodes = quickAskTextToNodes(text);
  if (nodes.length === 0) return false;

  if (mode === "replace") {
    // One paragraph replacing text inside a paragraph stays inline.
    const content = nodes.length === 1 ? (nodes[0].content ?? []) : nodes;

    return editor.chain().focus().insertContentAt({ from, to }, content).run();
  }

  const $to = editor.state.doc.resolve(to);
  const position = $to.depth > 0 ? $to.after(1) : to;

  return editor.chain().focus().insertContentAt(position, nodes).run();
};
