import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormDatePicker } from '@vitnode/core/components/form/fields/date-picker'
import { toast } from 'sonner'
import { z } from 'zod'

const today = new Date()

export default function DatePickerAutoFormExample() {
  const formSchema = z.object({
    birthday: z.iso.date('Pick your birthday'),
    anniversary: z.iso.date().optional(),
  })

  return (
    <AutoForm
      className="w-72"
      fields={[
        {
          id: 'birthday',
          component: (props) => (
            <AutoFormDatePicker
              {...props}
              calendarProps={{
                captionLayout: 'dropdown',
                disabled: { after: today },
                endMonth: today,
                startMonth: new Date(today.getFullYear() - 100, 0),
              }}
              description="We'll send cake. Digitally."
              label="Birthday"
            />
          ),
        },
        {
          id: 'anniversary',
          component: (props) => (
            <AutoFormDatePicker {...props} label="Community anniversary" />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values) => {
        toast.success('Dates saved', {
          description: `Birthday: ${values.birthday}${values.anniversary ? `, anniversary: ${values.anniversary}` : ''}.`,
        })
      }}
    />
  )
}
