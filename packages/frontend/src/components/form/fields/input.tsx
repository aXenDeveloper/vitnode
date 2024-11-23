import { AutoFormComponentProps } from '@/components/form/auto-form';
import { FormControl } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { AutoFormLabel } from './common/label';
import { AutoFormTooltip } from './common/tooltip';

export function AutoFormInput({
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
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name' | 'value'>) {
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
        <Input
          value={field.value ?? ''}
          {...props}
          {...zodInputProps}
          disabled={isDisabled || props.disabled}
          onBlur={field.onBlur || props.onBlur}
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
