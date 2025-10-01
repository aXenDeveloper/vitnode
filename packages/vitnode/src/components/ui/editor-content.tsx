export const EditorContent = ({ content }: { content: string }) => {
  return (
    // eslint-disable-next-line @eslint-react/dom/no-dangerously-set-innerhtml
    <div className="tiptap" dangerouslySetInnerHTML={{ __html: content }} />
  );
};
