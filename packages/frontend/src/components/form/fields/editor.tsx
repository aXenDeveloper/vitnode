import { Editor } from '@/components/editor/editor';
import { AutoFormComponentProps } from '@/components/form/auto-form';
import { FormControl } from '@/components/ui/form';

import { AutoFormLabel } from './common/label';
import { AutoFormTooltip } from './common/tooltip';

export function AutoFormEditor({
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
  Omit<React.ComponentProps<typeof Editor>, 'name' | 'onChange' | 'value'>) {
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
        <Editor
          {...field}
          {...props}
          disabled={isDisabled || props?.disabled}
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
