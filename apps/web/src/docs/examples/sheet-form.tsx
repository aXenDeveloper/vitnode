import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormSheetFooter } from '@vitnode/core/components/form/auto-form-sheet-footer'
import { AutoFormSwitch } from '@vitnode/core/components/form/fields/switch'
import { AutoFormTextarea } from '@vitnode/core/components/form/fields/textarea'
import { Button } from '@vitnode/core/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@vitnode/core/components/ui/sheet'
import { Settings2Icon } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

const formSchema = z.object({
  enabled: z.boolean().default(true),
  welcome: z
    .string()
    .max(160)
    .default('Welcome aboard! Grab a coffee and say hi.'),
})

export default function SheetFormDemo() {
  const [open, setOpen] = React.useState(false)

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger
        render={
          <Button variant="outline">
            <Settings2Icon />
            Settings
          </Button>
        }
      />
      <SheetContent className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="border-b pe-14">
          <SheetTitle>Welcome message</SheetTitle>
          <SheetDescription>
            Shown to members after they sign up.
          </SheetDescription>
        </SheetHeader>
        <AutoForm
          className="flex min-h-0 flex-1 flex-col gap-0"
          fields={[
            {
              id: 'enabled',
              component: (props) => (
                <AutoFormSwitch {...props} label="Show the message" />
              ),
            },
            {
              id: 'welcome',
              component: (props) => (
                <AutoFormTextarea {...props} label="Message" />
              ),
            },
          ]}
          formSchema={formSchema}
          layout={(rendered) => (
            <>
              <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-5">
                {rendered.enabled}
                {rendered.welcome}
              </div>
              <AutoFormSheetFooter submitLabel="Save message" />
            </>
          )}
          onSubmit={() => {
            toast.success('Message saved', {
              description: 'New members see it from now on.',
            })
            setOpen(false)
          }}
        />
      </SheetContent>
    </Sheet>
  )
}
