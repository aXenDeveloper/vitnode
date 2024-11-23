import { AutoFormComponentProps } from '@/components/form/auto-form';
import { IconPicker } from '@/components/icon/picker/icon-picker';
import { FormControl } from '@/components/ui/form';

import { AutoFormLabel } from './common/label';
import { AutoFormTooltip } from './common/tooltip';

export function AutoFormIconPicker({
  field,
  label,
  theme,
  description,
  isRequired,
  isDisabled,
  hideOptionalLabel,
  zodInputProps,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  overrideOptions: _,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  shape: _shape,
  ...props
}: AutoFormComponentProps &
  Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'name' | 'required' | 'value'
  >) {
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
        <IconPicker
          required={isRequired}
          {...field}
          {...zodInputProps}
          {...props}
          disabled={isDisabled || props.disabled}
          // onBlur={field.onBlur || props.onBlur}
          onChange={field.onChange}
          value={field.value ?? ''}
        />
      </FormControl>

      {description && theme === 'vertical' && (
        <AutoFormTooltip description={description} />
      )}
    </>
  );
}
