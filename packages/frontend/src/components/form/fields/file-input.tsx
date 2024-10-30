import { AutoFormComponentProps } from '@/components/form/auto-form';
import { FileInput } from '@/components/ui/file-input';
import { FormControl, FormMessage } from '@/components/ui/form';
import { cn } from '@/helpers/classnames';

import { AutoFormInputWrapper } from './common/input-wrapper';
import { AutoFormLabel } from './common/label';
import { AutoFormTooltip } from './common/tooltip';
import { AutoFormWrapper } from './common/wrapper';

export function AutoFormFileInput({
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
  Omit<React.ComponentProps<typeof FileInput>, 'name' | 'onChange' | 'value'>) {
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
          <FileInput
            required={isRequired}
            {...field}
            {...props}
            {...zodInputProps}
            className={cn('w-full', props.className)}
            disabled={isDisabled || props.disabled}
            onBlur={field.onBlur || props.onBlur}
            onChange={e => {
              field.onChange(e);
            }}
            value={field.value ?? []}
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
