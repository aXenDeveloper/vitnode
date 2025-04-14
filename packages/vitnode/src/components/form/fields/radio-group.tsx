import {
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { getBaseSchema } from '@/lib/helpers/auto-form';
import React from 'react';
import { z } from 'zod';

import { AutoFormDesc } from '../common/desc';
import { AutoFormLabel } from '../common/label';
import { ItemAutoFormComponentProps } from './item';

export function AutoFormRadioGroup<T extends z.ZodTypeAny>({
  label,
  field,
  description,
  shape,
  labels = [],
  ...props
}: ItemAutoFormComponentProps<T> &
  Omit<React.ComponentProps<typeof RadioGroup>, 'value'> & {
    description?: React.ReactNode;
    label?: React.ReactNode;
    labels?: { label: string; value: string }[];
  }) {
  const baseValues = (
    getBaseSchema(shape, true) as unknown as z.ZodEnum<[string, ...string[]]>
  )._def.values;
  const values: { label: string; value: string }[] = baseValues.map(value => {
    const label = labels.find(l => l.value === value)?.label;

    return {
      value,
      label: label ?? value,
    };
  });

  return (
    <FormItem className="space-y-3">
      {label && <AutoFormLabel>{label}</AutoFormLabel>}

      <FormControl>
        <RadioGroup
          defaultValue={field.value}
          onValueChange={field.onChange}
          {...props}
        >
          {values.map(({ value, label }) => (
            <FormItem
              className="flex items-center space-x-3 space-y-0"
              key={value}
            >
              <FormControl>
                <RadioGroupItem value={value} />
              </FormControl>
              <FormLabel className="font-normal">{label}</FormLabel>
            </FormItem>
          ))}
        </RadioGroup>
      </FormControl>

      {description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </FormItem>
  );
}
