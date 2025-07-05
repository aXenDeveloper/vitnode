'use client';

import { AutoForm } from '@vitnode/core/components/form/auto-form';
import { AutoFormInput } from '@vitnode/core/components/form/fields/input';
import { z } from 'zod';

export default function InputExample() {
  const formSchema = z.object({
    username: z.string().min(3, 'Username must be at least 3 characters'),
    email: z.string().email('Please enter a valid email address'),
  });

  return (
    <AutoForm
      fields={[
        {
          id: 'username',
          component: props => (
            <AutoFormInput
              description="This is the username for your application. It should be unique and not shared with anyone."
              label="Username"
              {...props}
            />
          ),
        },
        {
          id: 'email',
          component: props => (
            <AutoFormInput
              description="We'll use this email to contact you."
              label="Email Address"
              type="email"
              {...props}
            />
          ),
        },
      ]}
      formSchema={formSchema}
    />
  );
}
