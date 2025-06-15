'use client';

import { z } from 'zod';

import { AutoForm } from '@/components/form/auto-form';
import { AutoFormCheckbox } from '@/components/form/fields/checkbox';
import { AutoFormCombobox } from '@/components/form/fields/combobox';
import { AutoFormInput } from '@/components/form/fields/input';
import { AutoFormRadioGroup } from '@/components/form/fields/radio-group';
import { AutoFormSelect } from '@/components/form/fields/select';
import { AutoFormSwitch } from '@/components/form/fields/switch';
import { AutoFormTextarea } from '@/components/form/fields/textarea';
import { Card } from '@/components/ui/card';

export const TestView = () => {
  const formSchema = z.object({
    provider: z.string().min(1, { message: 'Provider is required' }),
    client_secret: z.string().min(1, { message: 'Client Secret is required' }),
    terms: z.boolean().refine(val => val, {
      message: 'You must accept the terms and conditions',
    }),
    options: z.enum(['option1', 'option2', 'option3']).default('option1'),
    options_long: z.enum(['option1', 'option2', 'option3']).default('option2'),
    switch: z.boolean().default(false),
    type: z.enum(['option-one', 'option-two']),
  });

  return (
    <div className="p-4">
      <Card className="p-6">
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
                <AutoFormTextarea
                  description="This is the client secret for your application. It should be kept
                secret and not shared with anyone."
                  label="Client Secret"
                  {...props}
                />
              ),
            },
            {
              id: 'terms',
              component: props => (
                <AutoFormCheckbox
                  description="By checking this box, you agree to the terms and conditions."
                  label="I agree to the terms and conditions"
                  {...props}
                />
              ),
            },
            {
              id: 'options',
              component: props => (
                <AutoFormRadioGroup
                  description="By checking this box, you agree to the terms and conditions."
                  label="I agree to the terms and conditions"
                  labels={[
                    {
                      value: 'option1',
                      label:
                        'Option 1 with a very long label that should be truncated',
                    },
                    {
                      value: 'option2',
                      label: 'Option 2',
                    },
                    {
                      value: 'option3',
                      label: 'Option 3',
                    },
                  ]}
                  {...props}
                />
              ),
            },
            {
              id: 'options_long',
              component: props => (
                <AutoFormSelect
                  description="By checking this box, you agree to the terms and conditions."
                  label="I agree to the terms and conditions"
                  labels={[
                    {
                      value: 'option1',
                      label:
                        'Option 1 with a very long label that should be truncated',
                    },
                    {
                      value: 'option2',
                      label: 'Option 2',
                    },
                    {
                      value: 'option3',
                      label: 'Option 3',
                    },
                  ]}
                  placeholder="Select an option from the list"
                  {...props}
                />
              ),
            },
            {
              id: 'switch',
              component: props => (
                <AutoFormSwitch
                  description="By checking this box, you agree to the terms and conditions."
                  label="I agree to the terms and conditions"
                  {...props}
                />
              ),
            },
            {
              id: 'type',
              component: props => (
                <AutoFormCombobox
                  description="By checking this box, you agree to the terms and conditions."
                  label="Type"
                  labels={[
                    {
                      value: 'option-one',
                      label: 'Option One',
                    },
                    {
                      value: 'option-two',
                      label: 'Option Two',
                    },
                  ]}
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
      </Card>
    </div>
  );
};
