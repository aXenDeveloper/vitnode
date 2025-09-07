export const EditorContent = ({ content }: { content: string }) => {
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: Necessary for rendering HTML content
    <div className="tiptap" dangerouslySetInnerHTML={{ __html: content }} />
  );
};
