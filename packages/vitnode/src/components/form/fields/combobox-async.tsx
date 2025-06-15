import type { z } from 'zod';

import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useDebouncedCallback } from 'use-debounce';

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
import { cn } from '@/lib/utils';

import type { ItemAutoFormComponentProps } from './item';

import { Skeleton } from '../../ui/skeleton';
import { AutoFormDesc } from '../common/desc';
import { AutoFormLabel } from '../common/label';

export function AutoFormComboboxAsync<T extends z.ZodTypeAny>({
  label,
  field,
  description,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  shape: _s,
  placeholder,
  className,
  id,
  searchPlaceholder,
  fetchData,
  ...props
}: ItemAutoFormComponentProps<T> &
  Omit<React.ComponentProps<typeof Button>, 'role' | 'variant'> & {
    description?: React.ReactNode;
    fetchData: (params: { search: string }) =>
      | Promise<
          {
            label: string;
            value: string;
          }[]
        >
      | {
          label: string;
          value: string;
        }[];
    id: string;
    label?: React.ReactNode;
    placeholder?: string;
    searchPlaceholder?: string;
  }) {
  const t = useTranslations('core.global');
  const [search, setSearch] = React.useState('');
  const { data, isLoading } = useQuery({
    queryKey: [id, { search }],
    queryFn: async () => {
      return await fetchData({ search });
    },
  });

  const handleChangeSearch = useDebouncedCallback((value: string) => {
    setSearch(value);
  }, 500);

  return (
    <FormItem className="flex flex-col">
      {label && <AutoFormLabel>{label}</AutoFormLabel>}

      <Popover>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              className={cn(
                'w-[200px] justify-between bg-transparent',
                !field.value && 'text-muted-foreground',
                className,
              )}
              role="combobox"
              variant="outline"
              {...props}
            >
              {field.value && field.value.label
                ? field.value.label
                : (placeholder ?? t('select_option'))}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </FormControl>
        </PopoverTrigger>

        <PopoverContent className="w-[200px] p-0">
          <Command shouldFilter={false}>
            <CommandInput
              onChangeCapture={e => {
                handleChangeSearch(e.currentTarget.value);
              }}
              placeholder={searchPlaceholder ?? t('search_placeholder')}
            />

            <CommandList>
              {isLoading ? (
                <div className="space-y-2 p-2">
                  <Skeleton className="h-6 rounded-sm" />
                  <Skeleton className="h-6 rounded-sm" />
                </div>
              ) : (
                <>
                  {data?.length === 0 ? (
                    <CommandEmpty>{t('results_not_found')}</CommandEmpty>
                  ) : (
                    <CommandGroup>
                      {(data ?? []).map(({ label, value }) => (
                        <CommandItem
                          key={value}
                          onSelect={() => {
                            field.onChange({
                              label,
                              value,
                            });
                          }}
                          value={label}
                        >
                          {label}
                          <Check
                            className={cn(
                              'ml-auto',
                              value === field.value?.value
                                ? 'opacity-100'
                                : 'opacity-0',
                            )}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </FormItem>
  );
}
