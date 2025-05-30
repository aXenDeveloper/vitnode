import type { z } from 'zod';

import { useTranslations } from 'next-intl';
import React from 'react';

import { FormControl, FormItem, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getBaseSchema } from '@/lib/helpers/auto-form';

import type { ItemAutoFormComponentProps } from './item';

import { AutoFormDesc } from '../common/desc';
import { AutoFormLabel } from '../common/label';

export function AutoFormSelect<T extends z.ZodTypeAny>({
  label,
  field,
  description,
  shape,
  placeholder,
  labels = [],
  ...props
}: ItemAutoFormComponentProps<T> &
  Omit<React.ComponentProps<typeof Select>, 'value'> & {
    description?: React.ReactNode;
    label?: React.ReactNode;
    labels?: { label: string; value: string }[];
    placeholder?: string;
  }) {
  const t = useTranslations('core.global');
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

  const currentPlaceholder =
    (values ?? labels).find(l => l.value === field.value)?.label ??
    t('select_option');

  return (
    <FormItem className="space-y-3">
      {label && <AutoFormLabel>{label}</AutoFormLabel>}

      <FormControl>
        <Select
          defaultValue={field.value}
          disabled={props.disabled}
          onValueChange={e => {
            field.onChange(e);
            props?.onValueChange?.(e);
          }}
          {...props}
        >
          <SelectTrigger {...props}>
            <SelectValue
              onBlur={field.onBlur}
              placeholder={placeholder ?? currentPlaceholder}
            >
              {currentPlaceholder}
            </SelectValue>
          </SelectTrigger>

          <SelectContent>
            {values.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormControl>

      {description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </FormItem>
  );
}
