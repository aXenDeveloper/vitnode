import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormEditor } from '@vitnode/core/components/form/fields/editor'
import { toast } from 'sonner'
import { z } from 'zod'

const DRAFT = [
  '<h3>Community meetup: Kraków</h3>',
  '<p>We are meeting on <strong>18 October</strong> at the old tram depot. Bring a laptop and your favourite plugin idea.</p>',
  '<div data-panel="info"><p>Type <code>/</code> for blocks or <code>:</code> for emoji.</p></div>',
  '<ul data-type="taskList">',
  '<li data-type="taskItem" data-checked="true"><p>Book the venue</p></li>',
  '<li data-type="taskItem" data-checked="false"><p>Order pizza for 40 people</p></li>',
  '</ul>',
].join('')

export default function EditorExample() {
  const formSchema = z.object({
    content: z.string().min(1, 'Write something first').default(DRAFT),
  })

  return (
    <AutoForm
      className="w-full"
      fields={[
        {
          id: 'content',
          component: (props) => (
            <AutoFormEditor
              {...props}
              description="Press Ctrl/⌘ + Enter to publish."
              label="Announcement"
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values) => {
        toast.success('Announcement published', {
          description: `${values.content.length} characters of HTML saved.`,
        })
      }}
    />
  )
}
