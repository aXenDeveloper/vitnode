import { EditorContent } from '@vitnode/core/components/ui/editor-content'

const POST = [
  '<h3>Release checklist</h3>',
  '<p>Everything we need before <em>v2.0</em> goes out to the community.</p>',
  '<ul data-type="taskList">',
  '<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked disabled><span></span></label><div><p>Write the changelog</p></div></li>',
  '<li data-type="taskItem" data-checked="false"><label><input type="checkbox" disabled><span></span></label><div><p>Update the docs screenshots</p></div></li>',
  '</ul>',
  '<script>alert("never runs")</script>',
].join('')

export default function EditorContentExample() {
  return (
    <article className="not-prose w-full">
      <EditorContent content={POST} />
    </article>
  )
}
