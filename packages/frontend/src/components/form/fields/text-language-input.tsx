import { AutoFormComponentProps } from '@/components/form/auto-form';
import { FormControl } from '@/components/ui/form';
import { StringLanguageInput } from '@/components/ui/text-language-input';

import { AutoFormLabel } from './common/label';
import { AutoFormTooltip } from './common/tooltip';

export function AutoFormStringLanguageInput({
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
    React.ComponentProps<typeof StringLanguageInput>,
    'name' | 'onChange' | 'value'
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
        <StringLanguageInput
          {...props}
          {...zodInputProps}
          disabled={isDisabled || props.disabled}
          onBlur={field.onBlur || props.onBlur}
          onChange={e => {
            field.onChange(e);
          }}
          value={field.value ?? []}
        />
      </FormControl>

      {description && theme === 'vertical' && (
        <AutoFormTooltip description={description} />
      )}
    </>
  );
}
