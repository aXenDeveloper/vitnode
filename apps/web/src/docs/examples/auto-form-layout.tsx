import {
  AutoForm,
  AutoFormSubmitButton,
} from '@vitnode/core/components/form/auto-form'
import { AutoFormInput } from '@vitnode/core/components/form/fields/input'
import { toast } from 'sonner'
import { z } from 'zod'

export default function AutoFormLayoutExample() {
  const formSchema = z.object({
    firstName: z.string().min(1, 'Required').default(''),
    lastName: z.string().min(1, 'Required').default(''),
    title: z.string().optional(),
  })

  return (
    <AutoForm
      className="w-full"
      fields={[
        {
          id: 'firstName',
          component: (props) => <AutoFormInput {...props} label="First name" />,
        },
        {
          id: 'lastName',
          component: (props) => <AutoFormInput {...props} label="Last name" />,
        },
        {
          id: 'title',
          component: (props) => (
            <AutoFormInput {...props} label="Member title" />
          ),
        },
      ]}
      formSchema={formSchema}
      layout={(rendered) => (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {rendered.firstName}
            {rendered.lastName}
          </div>
          {rendered.title}
          <div className="flex justify-end gap-2">
            <AutoFormSubmitButton intent="draft" variant="ghost">
              Save draft
            </AutoFormSubmitButton>
            <AutoFormSubmitButton intent="publish">
              Publish
            </AutoFormSubmitButton>
          </div>
        </>
      )}
      onSubmit={(values, _form, { intent }) => {
        toast.success(
          intent === 'draft' ? 'Draft saved' : 'Profile published',
          {
            description: `${values.firstName} ${values.lastName}`,
          },
        )
      }}
    />
  )
}
