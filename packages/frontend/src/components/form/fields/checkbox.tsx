import { AutoFormComponentProps } from '@/components/form/auto-form';
import { Checkbox } from '@/components/ui/checkbox';
import { FormControl } from '@/components/ui/form';

import { AutoFormLabel } from './common/label';
import { AutoFormTooltip } from './common/tooltip';

export function AutoFormCheckbox({
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
  Omit<React.ComponentProps<typeof Checkbox>, 'name' | 'value'>) {
  return (
    <>
      <FormControl>
        <Checkbox
          checked={field.value || false}
          disabled={isDisabled || props.disabled}
          onCheckedChange={e => {
            field.onChange(e);
            props.onCheckedChange?.(e);
          }}
          {...props}
        />
      </FormControl>

      {(label ?? description) && (
        <div className="space-y-1 leading-none">
          {label && (
            <AutoFormLabel
              description={description}
              hideOptionalLabel={hideOptionalLabel}
              isRequired={isRequired}
              label={label}
              theme={theme}
            />
          )}
          {description && theme === 'vertical' && (
            <AutoFormTooltip description={description} />
          )}
        </div>
      )}
    </>
  );
}
