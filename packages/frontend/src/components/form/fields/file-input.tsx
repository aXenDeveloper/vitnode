import { AutoFormComponentProps } from '@/components/form/auto-form';
import { FileInput, FilesInputValue } from '@/components/ui/file-input';
import { FormControl } from '@/components/ui/form';
import { cn } from '@/helpers/classnames';

import { AutoFormLabel } from './common/label';
import { AutoFormTooltip } from './common/tooltip';

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
  ...props
}: AutoFormComponentProps &
  Omit<React.ComponentProps<typeof FileInput>, 'name' | 'onChange' | 'value'>) {
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
        <FileInput
          required={isRequired}
          {...field}
          {...props}
          {...zodInputProps}
          className={cn('w-full', props.className)}
          disabled={isDisabled || props.disabled}
          multiple={props.multiple}
          onBlur={field.onBlur || props.onBlur}
          onChange={(e: FilesInputValue | FilesInputValue[] | null) => {
            field.onChange(e);
          }}
          value={field.value}
        />
      </FormControl>

      {description && theme === 'vertical' && (
        <AutoFormTooltip description={description} />
      )}
    </>
  );
}
