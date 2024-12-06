import { AutoFormComponentProps } from '@/components/form/auto-form';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { FormControl } from '@/components/ui/form';
import { Loader } from '@/components/ui/loader';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/helpers/classnames';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { StringLanguage } from 'vitnode-shared/string-language.dto';
import { z } from 'zod';

import { getBaseSchema } from '../utils';
import { AutoFormLabel } from './common/label';
import { AutoFormTooltip } from './common/tooltip';
import { ComboBoxButton } from './utils/combobox/combobox-button';

const ComboboxContentWithFetcher = React.lazy(async () =>
  import('./utils/combobox/combobox-content-with-fetcher').then(module => ({
    default: module.ComboboxContentWithFetcher,
  })),
);

export function AutoFormCombobox({
  field,
  label,
  theme,
  description,
  isRequired,
  isDisabled,
  hideOptionalLabel,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  zodInputProps: _zodInputProps,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  overrideOptions: _,
  shape,
  withFetcher,
  multiple,
  labels,
  placeholder,
  placeholderSearchInput,
  ...props
}: AutoFormComponentProps &
  Omit<React.ComponentProps<typeof Button>, 'role' | 'variant'> & {
    labels?: Record<string, React.JSX.Element | string>;
    multiple?: boolean;
    placeholder?: string;
    placeholderSearchInput?: string;
    withFetcher?: Omit<
      React.ComponentProps<typeof ComboboxContentWithFetcher>,
      'multiple' | 'onSelect' | 'placeholder' | 'value'
    >;
  }) {
  const t = useTranslations('core.global');
  const [open, setOpen] = React.useState(false);
  const value: string | string[] | undefined = field.value;
  const baseValues = (
    getBaseSchema(shape, true) as unknown as z.ZodEnum<[string, ...string[]]>
  )._def.values;

  let values: [string, string][] = [];
  if (!withFetcher) {
    if (!Array.isArray(baseValues)) {
      values = Object.entries(baseValues as object);
    } else {
      values = baseValues.map(value => [value, value]);
    }
  }

  const onSelectWithFetcher = ({
    key,
    value,
  }: {
    key: string;
    value: string | StringLanguage[];
  }) => {
    const currentValue:
      | undefined
      | {
          key: string;
          value: string | StringLanguage[];
        }
      | {
          key: string;
          value: string | StringLanguage[];
        }[] = field.value;
    const currentArrayValues = Array.isArray(currentValue)
      ? currentValue
      : currentValue
        ? [currentValue]
        : [];

    const findKey = currentArrayValues.find(el => el.key === key);

    if (multiple) {
      field.onChange(
        findKey
          ? currentArrayValues.filter(el => el.key !== key)
          : [...currentArrayValues, { key, value }],
      );

      return;
    }

    field.onChange(findKey && !isRequired ? [] : [{ key, value }]);
    setOpen(false);
  };

  return (
    <>
      {label && (
        <AutoFormLabel
          description={description}
          hideOptionalLabel={hideOptionalLabel}
          isRequired={isRequired}
          label={label}
          theme={theme}
        />
      )}

      <Popover modal onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <FormControl>
            <ComboBoxButton
              disabled={isDisabled || props?.disabled}
              field={field}
              label={label}
              labels={labels}
              multiple={multiple}
              placeholder={placeholder}
              values={values}
              withFetcher={!!withFetcher}
              {...props}
            />
          </FormControl>
        </PopoverTrigger>

        <PopoverContent align="start" className="p-0">
          {withFetcher ? (
            <React.Suspense fallback={<Loader className="p-4" />}>
              <ComboboxContentWithFetcher
                {...withFetcher}
                multiple={multiple}
                onSelect={onSelectWithFetcher}
                placeholder={placeholderSearchInput}
                value={field.value}
              />
            </React.Suspense>
          ) : (
            <Command>
              <CommandInput
                placeholder={
                  placeholderSearchInput
                    ? placeholderSearchInput
                    : t('search_placeholder')
                }
              />
              <CommandList>
                <CommandEmpty>{t('no_results')}</CommandEmpty>
                <CommandGroup>
                  {values.map(([valueItem, labelFromProps]) => {
                    const label = labels?.[valueItem] ?? labelFromProps;
                    const currentArrayValues = Array.isArray(value)
                      ? value
                      : value
                        ? [value]
                        : [];

                    return (
                      <CommandItem
                        key={valueItem}
                        onSelect={() => {
                          if (multiple) {
                            field.onChange(
                              currentArrayValues.includes(valueItem)
                                ? currentArrayValues.filter(
                                    el => el !== valueItem,
                                  )
                                : [...currentArrayValues, valueItem],
                            );

                            return;
                          }

                          field.onChange(valueItem);
                          setOpen(false);
                        }}
                        value={labelFromProps}
                      >
                        {multiple ? (
                          <div
                            className={cn(
                              'border-primary mr-2 flex size-4 items-center justify-center rounded-sm border',
                              currentArrayValues.includes(valueItem)
                                ? 'bg-primary text-primary-foreground'
                                : 'opacity-50 [&_svg]:invisible',
                            )}
                          >
                            <Check />
                          </div>
                        ) : (
                          <Check
                            className={cn(
                              'mr-2 size-4',
                              value === valueItem ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                        )}

                        {label}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          )}
        </PopoverContent>
      </Popover>

      {description && theme === 'vertical' && (
        <AutoFormTooltip description={description} />
      )}
    </>
  );
}
