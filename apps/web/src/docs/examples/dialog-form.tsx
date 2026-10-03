import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormInput } from '@vitnode/core/components/form/fields/input'
import { AutoFormTextarea } from '@vitnode/core/components/form/fields/textarea'
import { Button } from '@vitnode/core/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  useDialog,
} from '@vitnode/core/components/ui/dialog'
import { PencilIcon } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

const formSchema = z.object({
  name: z
    .string()
    .min(3, 'Give it at least 3 characters')
    .default('Announcements'),
  description: z.string().max(160).default('News and updates from the team.'),
})

const EditCategoryForm = () => {
  const { setOpen } = useDialog()

  return (
    <AutoForm
      fields={[
        {
          id: 'name',
          component: (props) => <AutoFormInput {...props} label="Name" />,
        },
        {
          id: 'description',
          component: (props) => (
            <AutoFormTextarea {...props} label="Description" />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values) => {
        toast.success('Category saved', { description: values.name })
        setOpen?.(false)
      }}
    />
  )
}

export default function DialogFormDemo() {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline">
            <PencilIcon />
            Edit category
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit category</DialogTitle>
          <DialogDescription>
            Change a field, then try to close the dialog.
          </DialogDescription>
        </DialogHeader>
        <EditCategoryForm />
      </DialogContent>
    </Dialog>
  )
}
