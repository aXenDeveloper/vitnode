'use client';

import { AutoForm } from '@vitnode/core/components/form/auto-form';
import { AutoFormCombobox } from '@vitnode/core/components/form/fields/combobox';
import { z } from 'zod';

export default function ComboboxExample() {
  const formSchema = z.object({
    type: z.enum(['option-one', 'option-two']),
  });

  return (
    <AutoForm
      fields={[
        {
          id: 'type',
          component: props => (
            <AutoFormCombobox
              description="Select an option from the list"
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
    />
  );
}
