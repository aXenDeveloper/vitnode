import { AutoFormComponentProps } from '@/components/form/auto-form';
import { DatePicker } from '@/components/ui/date-picker';
import { FormControl } from '@/components/ui/form';

import { AutoFormLabel } from './common/label';
import { AutoFormTooltip } from './common/tooltip';

export function AutoFormDatePicker({
  field,
  label,
  theme,
  description,
  isRequired,
  isDisabled,
  hideOptionalLabel,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  zodInputProps: _ZodInputProps,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  overrideOptions: _,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  shape: _shape,
  ...props
}: AutoFormComponentProps &
  Omit<React.ComponentProps<typeof DatePicker>, 'name' | 'value'>) {
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
        <DatePicker
          {...field}
          {...props}
          className="flex"
          disabled={isDisabled || props.disabled}
          onChange={e => {
            field.onChange(e);
            props.onChange?.(e);
          }}
        />
      </FormControl>

      {description && theme === 'vertical' && (
        <AutoFormTooltip description={description} />
      )}
    </>
  );
}
