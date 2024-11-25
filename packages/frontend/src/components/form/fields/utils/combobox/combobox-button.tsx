import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/helpers/classnames';
import { useTextLang } from '@/hooks/use-text-lang';
import { ChevronsUpDownIcon, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { ControllerRenderProps, FieldValues } from 'react-hook-form';
import { StringLanguage } from 'vitnode-shared/string-language.dto';

interface ComboBoxButtonProps<T extends FieldValues>
  extends Omit<React.ComponentProps<typeof Button>, 'ariaLabel' | 'children'> {
  field: ControllerRenderProps<T>;
  label?: React.ReactNode | string;
  labels?: Record<string, React.JSX.Element | string>;
  multiple?: boolean;
  placeholder?: string;
  values: [string, string][];
  withFetcher?: boolean;
}

export function ComboBoxButton<T extends FieldValues>({
  label,
  className,
  field,
  values,
  multiple,
  labels,
  withFetcher,
  placeholder,
  ...props
}: ComboBoxButtonProps<T>) {
  const t = useTranslations('core.global');
  const { convertText } = useTextLang();

  const getButtonPlaceholder = () => {
    if (withFetcher) {
      const currentValue:
        | {
            key: string;
            value: string | StringLanguage[];
          }
        | {
            key: string;
            value: string | StringLanguage[];
          }[]
        | undefined = field.value;
      const currentArrayValues = Array.isArray(currentValue)
        ? currentValue
        : currentValue
          ? [currentValue]
          : [];

      if (multiple && currentArrayValues.length > 0) {
        return t('selected', { count: currentArrayValues.length });
      }

      if (currentArrayValues.length > 0) {
        return Array.isArray(currentArrayValues[0].value)
          ? convertText(currentArrayValues[0].value)
          : currentArrayValues[0].value;
      }

      return null;
    }

    const value = field.value;

    if (multiple && Array.isArray(value) && value.length > 0) {
      return t('selected', { count: value.length });
    }

    const current = values.find(item => item[0] === value);
    const item = current?.[1];

    if (current) {
      return labels?.[current[0]] ?? item;
    }

    return item;
  };

  const placeholderButton = getButtonPlaceholder();

  return (
    <Button
      ariaLabel={typeof label === 'string' ? label : ''}
      className={cn('w-full justify-start font-normal', className)}
      role="combobox"
      variant="outline"
      {...props}
    >
      {placeholderButton ? (
        multiple ? (
          <Badge
            className="shrink-0 [&>svg]:size-4"
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
              field.onChange([]);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.stopPropagation();
                e.preventDefault();
                field.onChange([]);
              }
            }}
          >
            {placeholderButton} <X />
          </Badge>
        ) : (
          <span>{placeholderButton}</span>
        )
      ) : (
        <span className="text-muted-foreground">
          {placeholder
            ? placeholder
            : t(multiple ? 'select_options' : 'select_option')}
        </span>
      )}
      <ChevronsUpDownIcon className="ml-auto size-4 shrink-0 opacity-50" />
    </Button>
  );
}
