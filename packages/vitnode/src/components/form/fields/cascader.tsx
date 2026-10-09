import type { ItemAutoFormComponentProps } from "../auto-form";

import { Cascader } from "../../ui/cascader";
import { FormControl, FormMessage } from "../../ui/form";
import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";

type CascaderProps = React.ComponentProps<typeof Cascader>;

export const AutoFormCascader = ({
  label,
  labelRight,
  description,
  otherProps: { isOptional },
  field,
  options,
  onValueChange,
  showClear,
  // oxlint-disable-next-line no-unused-vars
  itemParams,
  // oxlint-disable-next-line no-unused-vars
  multiLang,
  // oxlint-disable-next-line no-unused-vars
  children,
  ...props
}: ItemAutoFormComponentProps &
  Omit<CascaderProps, "defaultValue" | "value">) => (
  <>
    {!!label && (
      <AutoFormLabel isOptional={isOptional} labelRight={labelRight}>
        {label}
      </AutoFormLabel>
    )}

    <FormControl>
      <Cascader
        onValueChange={(value, path) => {
          field.onChange(value ?? undefined);
          field.onBlur();
          onValueChange?.(value, path);
        }}
        options={options}
        showClear={showClear ?? isOptional}
        value={field.value ?? null}
        {...props}
      />
    </FormControl>

    {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
    <FormMessage />
  </>
);
