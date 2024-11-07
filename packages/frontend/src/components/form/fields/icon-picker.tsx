import { AutoFormComponentProps } from '@/components/form/auto-form';
import { IconPicker } from '@/components/icon/picker/icon-picker';
import { FormControl, FormMessage } from '@/components/ui/form';

import { AutoFormInputWrapper } from './common/input-wrapper';
import { AutoFormLabel } from './common/label';
import { AutoFormTooltip } from './common/tooltip';
import { AutoFormWrapper } from './common/wrapper';

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
  wrapper,
  classNameWrapper,
  ...props
}: AutoFormComponentProps &
  Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'name' | 'required' | 'value'
  >) {
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
      </AutoFormInputWrapper>

      {description && theme === 'vertical' && (
        <AutoFormTooltip description={description} />
      )}
      <FormMessage />
    </AutoFormWrapper>
  );
}
