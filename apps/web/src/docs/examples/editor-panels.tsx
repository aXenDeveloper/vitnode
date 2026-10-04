import { EditorContent } from '@vitnode/core/components/ui/editor-content'

const PANELS = [
  '<div class="tiptap-panel" data-panel="info"><p>Threads older than a year are archived automatically.</p></div>',
  '<div class="tiptap-panel" data-panel="warning"><p>Check your SMTP settings</p><p>Password reset emails will fail until a sender address is set.</p></div>',
  '<div class="tiptap-panel" data-panel="error"><p>Deleting a category removes every thread inside it.</p></div>',
  '<div class="tiptap-panel" data-panel="success"><p>Migration finished</p><p>12,480 posts moved without a single error.</p></div>',
].join('')

export default function EditorPanelsExample() {
  return (
    <div className="not-prose w-full">
      <EditorContent content={PANELS} />
    </div>
  )
}
