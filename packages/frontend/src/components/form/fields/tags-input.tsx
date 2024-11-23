import { AutoFormComponentProps } from '@/components/form/auto-form';
import { FormControl } from '@/components/ui/form';
import { TagInput } from '@/components/ui/tag-input';

import { AutoFormLabel } from './common/label';
import { AutoFormTooltip } from './common/tooltip';

export function AutoFormTagInput({
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
  Omit<React.ComponentProps<typeof TagInput>, 'name' | 'onChange' | 'value'>) {
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
        <TagInput
          {...props}
          disabled={isDisabled || props.disabled}
          onBlur={field.onBlur || props.onBlur}
          onChange={e => {
            field.onChange(e);
          }}
        />
      </FormControl>

      {description && theme === 'vertical' && (
        <AutoFormTooltip description={description} />
      )}
    </>
  );
}
