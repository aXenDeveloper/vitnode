import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { FormControl, FormItem, FormMessage } from '@/components/ui/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { getBaseSchema } from '@/lib/helpers/auto-form';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { z } from 'zod';

import { AutoFormDesc } from '../common/desc';
import { AutoFormLabel } from '../common/label';
import { ItemAutoFormComponentProps } from './item';

export function AutoFormCombobox<T extends z.ZodTypeAny>({
  label,
  field,
  description,
  shape,
  placeholder,
  className,
  labels = [],
  ...props
}: ItemAutoFormComponentProps<T> &
  Omit<React.ComponentProps<typeof Button>, 'role' | 'variant'> & {
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

  return (
    <FormItem className="flex flex-col">
      {label && <AutoFormLabel>{label}</AutoFormLabel>}

      <Popover>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              className={cn(
                'w-[200px] justify-between',
                !field.value && 'text-muted-foreground',
                className,
              )}
              role="combobox"
              variant="outline"
              {...props}
            >
              {field.value
                ? values.find(({ value }) => value === field.value)?.label
                : t('select_option')}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </FormControl>
        </PopoverTrigger>

        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput placeholder="Search language..." />
            <CommandList>
              <CommandEmpty>No language found.</CommandEmpty>
              <CommandGroup>
                {values.map(({ label, value }) => (
                  <CommandItem
                    key={value}
                    onSelect={() => {
                      field.onChange(value);
                    }}
                    value={label}
                  >
                    {label}
                    <Check
                      className={cn(
                        'ml-auto',
                        value === field.value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </FormItem>
  );
}
