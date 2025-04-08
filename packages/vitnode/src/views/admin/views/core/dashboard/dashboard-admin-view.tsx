'use client';

import { AutoForm } from '@/components/form/auto-form';
import { AutoFormInput } from '@/components/form/fields/input';
import { z } from 'zod';

export const DashboardAdminView = () => {
  const formSchema = z.object({
    provider: z.string().min(1, { message: 'Provider is required' }),
    client_secret: z.string().min(1, { message: 'Client Secret is required' }),
  });

  return (
    <div className="container mx-auto p-4">
      <AutoForm
        fields={[
          {
            id: 'provider',
            component: props => (
              <AutoFormInput
                description="This is the provider for your application. It should be a valid provider name."
                label="Provider"
                {...props}
              />
            ),
          },
          {
            id: 'client_secret',
            component: props => (
              <AutoFormInput
                description="This is the client secret for your application. It should be kept
                secret and not shared with anyone."
                label="Client Secret"
                {...props}
              />
            ),
          },
        ]}
        formSchema={formSchema}
        onSubmit={values => {
          // eslint-disable-next-line no-console
          console.log('Form submitted', values);
        }}
      />
    </div>
  );
};
