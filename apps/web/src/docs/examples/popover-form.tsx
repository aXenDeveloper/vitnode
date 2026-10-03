import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormInput } from '@vitnode/core/components/form/fields/input'
import { Button } from '@vitnode/core/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@vitnode/core/components/ui/popover'
import { LinkIcon } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

const formSchema = z.object({
  url: z.url('That does not look like a link'),
  text: z.string().optional(),
})

export default function PopoverFormDemo() {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button variant="outline">
            <LinkIcon />
            Add link
          </Button>
        }
      />
      <PopoverContent align="start" className="w-80">
        <PopoverHeader>
          <PopoverTitle>Add a link</PopoverTitle>
        </PopoverHeader>
        <AutoForm
          fields={[
            {
              id: 'url',
              component: (props) => (
                <AutoFormInput
                  {...props}
                  label="URL"
                  placeholder="https://"
                  type="url"
                />
              ),
            },
            {
              id: 'text',
              component: (props) => (
                <AutoFormInput {...props} label="Link text" />
              ),
            },
          ]}
          formSchema={formSchema}
          onSubmit={(values) => {
            toast.success('Link added', {
              description: values.text ?? values.url,
            })
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
