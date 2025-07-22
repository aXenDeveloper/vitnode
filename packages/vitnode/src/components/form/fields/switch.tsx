import { FormControl, FormItem } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';

import type { ItemAutoFormComponentProps } from '../auto-form';

import { AutoFormDesc } from '../common/desc';
import { AutoFormLabel } from '../common/label';

export const AutoFormSwitch = ({
  label,
  field,
  otherProps: { isOptional },
  description,
  ...props
}: ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof Switch>, 'checked'>) => {
  return (
    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
      {/* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing */}
      {(label || description) && (
        <div className="space-y-0.5">
          {label && (
            <AutoFormLabel className="text-base" isOptional={isOptional}>
              {label}
            </AutoFormLabel>
          )}
          {description && <AutoFormDesc>{description}</AutoFormDesc>}
        </div>
      )}

      <FormControl>
        <Switch
          checked={field.value ?? false}
          onCheckedChange={e => {
            field.onChange(e);
            props?.onCheckedChange?.(e);
          }}
          {...props}
        />
      </FormControl>
    </FormItem>
  );
};
