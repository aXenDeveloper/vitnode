import {
  AutoForm,
  type FormFieldApi,
  type ItemAutoFormComponentProps,
} from '@vitnode/core/components/form/auto-form'
import { AutoFormDesc } from '@vitnode/core/components/form/common/desc'
import { AutoFormLabel } from '@vitnode/core/components/form/common/label'
import { FormControl, FormMessage } from '@vitnode/core/components/ui/form'
import { toast } from 'sonner'
import { z } from 'zod'

const SlowModeField = ({
  description,
  field,
  label,
}: Omit<ItemAutoFormComponentProps, 'field'> & {
  field: FormFieldApi<number>
}) => (
  <>
    <div className="flex items-center justify-between gap-4">
      <AutoFormLabel>{label}</AutoFormLabel>
      <output className="text-muted-foreground text-sm tabular-nums">
        {field.value === 0 ? 'Off' : `${field.value}s`}
      </output>
    </div>
    <FormControl>
      <input
        className="accent-primary w-full"
        max={120}
        min={0}
        name={field.name}
        onBlur={field.onBlur}
        onChange={(event) => {
          field.onChange(Number(event.target.value))
        }}
        step={5}
        type="range"
        value={field.value}
      />
    </FormControl>
    {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
    <FormMessage />
  </>
)

export default function AutoFormCustomFieldExample() {
  const formSchema = z.object({
    slowMode: z.number().min(0).max(120).default(30),
  })

  return (
    <AutoForm
      className="w-full"
      fields={[
        {
          id: 'slowMode',
          component: (props) => (
            <SlowModeField
              {...props}
              description="Seconds a member waits between posts in this thread."
              label="Slow mode"
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values) => {
        toast.success('Slow mode updated', {
          description: `${values.slowMode} seconds`,
        })
      }}
    />
  )
}
