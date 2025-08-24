import type React from 'react';

import {
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

import type { ItemAutoFormComponentProps } from '../auto-form';

import { AutoFormDesc } from '../common/desc';
import { AutoFormLabel } from '../common/label';

export const AutoFormRadioGroup = ({
  label,
  labelRight,
  field,
  description,
  otherProps: { enum: enumValues = [], isOptional },
  labels = [],
  ...props
}: ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof RadioGroup>, 'value'> & {
    labels?: { label: string; value: string }[];
  }) => {
  const values: { label: string; value: string }[] = enumValues.map(value => {
    const label = labels.find(l => l.value === value)?.label;

    return {
      value,
      label: label ?? value,
    };
  });

  return (
    <FormItem className="space-y-3">
      {label && (
        <AutoFormLabel isOptional={isOptional} labelRight={labelRight}>
          {label}
        </AutoFormLabel>
      )}

      <FormControl>
        <RadioGroup
          defaultValue={field.value}
          disabled={props.disabled}
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
};
