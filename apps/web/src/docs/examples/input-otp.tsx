import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormInputOTP } from '@vitnode/core/components/form/fields/input-otp'
import { setFormFieldError } from '@vitnode/core/components/ui/form'
import { toast } from 'sonner'
import { z } from 'zod'

const DEMO_CODE = '123456'

export default function InputOTPExample() {
  const formSchema = z.object({
    code: z
      .string()
      .length(6, 'Enter all 6 digits')
      .regex(/^\d+$/, 'Only digits, please'),
  })

  return (
    <AutoForm
      fields={[
        {
          id: 'code',
          component: (props) => (
            <AutoFormInputOTP
              {...props}
              description={`We sent a 6-digit code to a****@vitnode.com. Psst, try ${DEMO_CODE}.`}
              label="Verify your account"
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values, form) => {
        if (values.code !== DEMO_CODE) {
          setFormFieldError(
            form,
            'code',
            "That code doesn't match. Give it another go.",
          )

          return
        }

        toast.success('Code verified', {
          description: 'Welcome aboard! Your account is now verified.',
        })
      }}
      submitButtonProps={{ children: 'Verify' }}
    />
  )
}
