import type { Editor, JSONContent } from "@tiptap/react";

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
    const content = nodes.length === 1 ? (nodes[0].content ?? []) : nodes;

    return editor.chain().focus().insertContentAt({ from, to }, content).run();
  }

  const $to = editor.state.doc.resolve(to);
  const position = $to.depth > 0 ? $to.after(1) : to;

  return editor.chain().focus().insertContentAt(position, nodes).run();
};
