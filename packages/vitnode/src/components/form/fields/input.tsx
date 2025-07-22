import type { ItemAutoFormComponentProps } from '../auto-form';

import { FormControl, FormItem, FormMessage } from '../../ui/form';
import { Input } from '../../ui/input';
import { AutoFormDesc } from '../common/desc';
import { AutoFormLabel } from '../common/label';

export const AutoFormInput = ({
  label,
  description,
  otherProps: { isOptional, maxLength, minLength, pattern, type },
  field,
  ...props
}: ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof Input>, 'value'>) => {
  return (
    <FormItem>
      {label && <AutoFormLabel isOptional={isOptional}>{label}</AutoFormLabel>}
      <FormControl>
        <Input
          {...field}
          maxLength={maxLength}
          minLength={minLength}
          onBlur={e => {
            field.onBlur();
            props.onBlur?.(e);
          }}
          onChange={e => {
            field.onChange(e);
            props.onChange?.(e);
          }}
          pattern={pattern}
          type={type ?? 'text'}
          value={field.value ?? ''}
          {...props}
        />
      </FormControl>

      {description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </FormItem>
  );
};
