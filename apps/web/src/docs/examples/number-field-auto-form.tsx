import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormNumber } from '@vitnode/core/components/form/fields/number'
import { toast } from 'sonner'
import { z } from 'zod'

export default function NumberFieldAutoFormExample() {
  const formSchema = z.object({
    guests: z.number().int().min(1).max(12).default(2),
    budget: z.number().min(0).default(250),
  })

  return (
    <AutoForm
      className="w-full"
      fields={[
        {
          id: 'guests',
          component: (props) => (
            <AutoFormNumber
              {...props}
              description="Up to 12 - the table only has so many chairs."
              label="Guests"
              max={12}
              min={1}
              unitLabel="people"
            />
          ),
        },
        {
          id: 'budget',
          component: (props) => (
            <AutoFormNumber
              {...props}
              format={{ currency: 'USD', style: 'currency' }}
              label="Budget"
              largeStep={100}
              min={0}
              step={10}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values) => {
        toast.success('Dinner booked', {
          description: `${values.guests} guests, $${values.budget} to spend.`,
        })
      }}
    />
  )
}
