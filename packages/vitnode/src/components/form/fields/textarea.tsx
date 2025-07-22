import React from 'react';

import { FormControl, FormItem, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';

import type { ItemAutoFormComponentProps } from '../auto-form';

import { AutoFormDesc } from '../common/desc';
import { AutoFormLabel } from '../common/label';

export const AutoFormTextarea = ({
  label,
  description,
  otherProps: { isOptional, maxLength, minLength },
  field,
  ...props
}: ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof Textarea>, 'value'> & {
    description?: React.ReactNode;
    label?: React.ReactNode;
  }) => {
  return (
    <FormItem>
      {label && <AutoFormLabel isOptional={isOptional}>{label}</AutoFormLabel>}

      <FormControl>
        <Textarea
          maxLength={maxLength}
          minLength={minLength}
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
};
