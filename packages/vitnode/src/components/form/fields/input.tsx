import { FormControl, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import React from 'react';
import { z } from 'zod';

import { AutoFormDesc } from '../common/desc';
import { AutoFormLabel } from '../common/label';
import { ItemAutoFormProps } from './item';

export function AutoFormInput<T extends z.ZodTypeAny>({
  label,
  field,
  description,
  ...props
}: ItemAutoFormProps<T> &
  Omit<React.ComponentProps<typeof Input>, 'value'> & {
    description?: React.ReactNode;
    label?: React.ReactNode;
  }) {
  return (
    <FormItem>
      {label && <AutoFormLabel>{label}</AutoFormLabel>}

      <FormControl>
        <Input
          onBlur={e => {
            field.onBlur();
            props.onBlur?.(e);
          }}
          onChange={e => {
            field.onChange(e);
            props.onChange?.(e);
          }}
          value={field.value ?? ''}
          {...props}
        />
      </FormControl>

      {description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </FormItem>
  );
}
