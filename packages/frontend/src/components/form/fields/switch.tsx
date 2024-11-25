import { FormControl } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/helpers/classnames';

import { AutoFormComponentProps } from '../auto-form';
import { AutoFormLabel } from './common/label';
import { AutoFormTooltip } from './common/tooltip';

export function AutoFormSwitch({
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
  Omit<React.ComponentProps<typeof Switch>, 'checked'>) {
  const value: boolean = field.value || false;

  return (
    <div
      className={cn({
        'gap-4 rounded-lg border p-4': theme === 'vertical',
      })}
    >
      <div>
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

      <FormControl>
        <Switch
          checked={value}
          onCheckedChange={e => {
            field.onChange(e);
            props?.onCheckedChange?.(e);
          }}
          {...props}
          disabled={isDisabled || props?.disabled}
        />
      </FormControl>
    </div>
  );
}
