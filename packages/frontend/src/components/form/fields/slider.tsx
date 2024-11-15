import { AutoFormComponentProps } from '@/components/form/auto-form';
import { FormControl, FormMessage } from '@/components/ui/form';
import { Slider } from '@/components/ui/slider';
import React from 'react';

import { AutoFormInputWrapper } from './common/input-wrapper';
import { AutoFormLabel } from './common/label';
import { AutoFormTooltip } from './common/tooltip';
import { AutoFormWrapper } from './common/wrapper';

export function AutoFormSlider({
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  shape: _shape,
  wrapper,
  classNameWrapper,
  ...props
}: {
  onChange?: (value: number[]) => void;
} & AutoFormComponentProps &
  Omit<React.ComponentProps<typeof Slider>, 'name' | 'value'>) {
  return (
    <AutoFormWrapper className={classNameWrapper} theme={theme}>
      {label && (
        <AutoFormLabel
          description={description}
          hideOptionalLabel={hideOptionalLabel}
          isRequired={isRequired}
          label={label}
          theme={theme}
        />
      )}

      <AutoFormInputWrapper field={field} Wrapper={wrapper}>
        <FormControl>
          <Slider
            max={30}
            min={1}
            onValueChange={value => {
              field.onChange(value[0]);
              props.onChange?.(value);
            }}
            value={[field.value ?? 0]}
            {...props}
            disabled={isDisabled || props.disabled}
            onBlur={field.onBlur || props.onBlur}
          />
        </FormControl>
      </AutoFormInputWrapper>

      {description && theme === 'vertical' && (
        <AutoFormTooltip description={description} />
      )}
      <FormMessage />
    </AutoFormWrapper>
  );
}
