import { AutoFormComponentProps } from '@/components/form/auto-form';
import { FormControl, FormItem, FormLabel } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { z } from 'zod';

import { getBaseSchema } from '../utils';
import { AutoFormLabel } from './common/label';
import { AutoFormTooltip } from './common/tooltip';

export function AutoFormRadioGroup({
  field,
  label,
  theme,
  description,
  isRequired,
  isDisabled,
  hideOptionalLabel,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  zodInputProps: _ZodInputProps,
  overrideOptions,
  labels,
  shape,
  ...props
}: AutoFormComponentProps &
  Omit<React.ComponentProps<typeof RadioGroup>, 'role' | 'variant'> & {
    labels?: Record<
      string,
      {
        description?: React.ReactNode;
        title: string;
      }
    >;
  }) {
  const baseValues = (
    getBaseSchema(shape, true) as unknown as z.ZodEnum<[string, ...string[]]>
  )._def.values;

  let values: [string, string][] = [];
  if (overrideOptions?.length) {
    values = overrideOptions.map(value => [value, value]);
  } else if (!Array.isArray(baseValues)) {
    values = Object.entries(baseValues as object);
  } else {
    values = baseValues.map(value => [value, value]);
  }

  // Move 'none' to the top
  const noneValue = values.find(value => value[0] === 'none');
  if (noneValue) {
    values = values.filter(value => value[0] !== 'none');
    values.unshift(noneValue);
  }

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

      <FormControl>
        <RadioGroup
          defaultValue={field.value}
          disabled={isDisabled || props?.disabled}
          onValueChange={field.onChange}
          {...props}
        >
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {values.map((value: any) => {
            const label = labels?.[value[1]]?.title ?? value[1];
            const description = labels?.[value[1]]?.description;

            return (
              <FormItem className="flex-row gap-3" key={value}>
                <FormControl>
                  <RadioGroupItem value={value[1]} />
                </FormControl>
                <FormLabel className="flex items-center font-normal">
                  <span>{label}</span>

                  {description && (
                    <span className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1 text-sm font-normal">
                      {description}
                    </span>
                  )}
                </FormLabel>
              </FormItem>
            );
          })}
        </RadioGroup>
      </FormControl>

      {description && theme === 'vertical' && (
        <AutoFormTooltip description={description} />
      )}
    </>
  );
}
