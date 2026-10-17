import { useMemo } from "react";

import { sanitizeEditorHtml } from "@/lib/sanitize-editor-html";

export const EditorContent = ({ content }: { content: string }) => {
  // Sanitizing parses the whole document, so it runs once per content, not
  // once per parent render.
  const html = useMemo(() => sanitizeEditorHtml(content), [content]);

  return (
    <div
      className="tiptap"
      // oxlint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
