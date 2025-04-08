import { Checkbox } from '@/components/ui/checkbox';
import { FormControl, FormItem, FormMessage } from '@/components/ui/form';
import { z } from 'zod';

import { AutoFormDesc } from '../common/desc';
import { AutoFormLabel } from '../common/label';
import { ItemAutoFormProps } from './item';

export function AutoFormCheckbox<T extends z.ZodTypeAny>({
  label,
  field,
  description,
  ...props
}: ItemAutoFormProps<T> &
  Omit<React.ComponentProps<typeof Checkbox>, 'checked'> & {
    description?: React.ReactNode;
    label?: React.ReactNode;
  }) {
  return (
    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
      <FormControl>
        <Checkbox
          checked={field.value || false}
          onCheckedChange={e => {
            field.onChange(e);
            props.onCheckedChange?.(e);
          }}
          {...props}
        />
      </FormControl>

      <div className="space-y-1 leading-none">
        {label && <AutoFormLabel>{label}</AutoFormLabel>}
        {description && <AutoFormDesc>{description}</AutoFormDesc>}
        <FormMessage />
      </div>
    </FormItem>
  );
}
