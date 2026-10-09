import { sanitizeEditorHtml } from "@/lib/sanitize-editor-html";

export const EditorContent = ({ content }: { content: string }) => {
  return (
    <div
      className="tiptap"
      // oxlint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
      dangerouslySetInnerHTML={{ __html: sanitizeEditorHtml(content) }}
    />
  );
};
