import type { z } from 'zod';

import { FormControl, FormItem } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';

import type { ItemAutoFormComponentProps } from './item';

import { AutoFormDesc } from '../common/desc';
import { AutoFormLabel } from '../common/label';

export function AutoFormSwitch<T extends z.ZodTypeAny>({
  label,
  field,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  shape: _,
  description,
  ...props
}: ItemAutoFormComponentProps<T> &
  Omit<React.ComponentProps<typeof Switch>, 'checked'> & {
    description?: React.ReactNode;
    label?: React.ReactNode;
  }) {
  return (
    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
      {!!(label ?? description) && (
        <div className="space-y-0.5">
          <AutoFormLabel className="text-base">Marketing emails</AutoFormLabel>
          <AutoFormDesc>
            Receive emails about new products, features, and more.
          </AutoFormDesc>
        </div>
      )}

      <FormControl>
        <Switch
          checked={field.value || false}
          onCheckedChange={e => {
            field.onChange(e);
            props?.onCheckedChange?.(e);
          }}
          {...props}
        />
      </FormControl>
    </FormItem>
  );
}
