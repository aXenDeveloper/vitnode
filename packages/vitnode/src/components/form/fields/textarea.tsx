import { FormControl, FormItem, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import React from 'react';
import { z } from 'zod';

import { AutoFormDesc } from '../common/desc';
import { AutoFormLabel } from '../common/label';
import { ItemAutoFormComponentProps } from './item';

export function AutoFormTextarea<T extends z.ZodTypeAny>({
  label,
  field,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  shape: _,
  description,
  ...props
}: ItemAutoFormComponentProps<T> &
  Omit<React.ComponentProps<typeof Textarea>, 'value'> & {
    description?: React.ReactNode;
    label?: React.ReactNode;
  }) {
  return (
    <FormItem>
      {label && <AutoFormLabel>{label}</AutoFormLabel>}

      <FormControl>
        <Textarea
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
