import { AutoFormComponentProps } from '@/components/form/auto-form';
import { ColorPicker } from '@/components/ui/color-picker';
import { FormControl } from '@/components/ui/form';

import { AutoFormLabel } from './common/label';
import { AutoFormTooltip } from './common/tooltip';

export function AutoFormColorPicker({
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
    React.ComponentProps<typeof ColorPicker>,
    'name' | 'onChange' | 'required' | 'value'
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
        <ColorPicker
          required={isRequired}
          {...field}
          {...zodInputProps}
          {...props}
          disabled={isDisabled || props.disabled}
          onChange={e => {
            field.onChange(e);
            // props.onChange?.(e);
          }}
          value={field.value || ''}
        />
      </FormControl>

      {description && theme === 'vertical' && (
        <AutoFormTooltip description={description} />
      )}
    </>
  );
}
