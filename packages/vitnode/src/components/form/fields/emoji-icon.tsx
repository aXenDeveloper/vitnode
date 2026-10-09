import type React from "react";

import { EmojiIconPicker } from "@/components/ui/emoji-icon-picker";
import { FormControl, FormMessage } from "@/components/ui/form";
import { parseEmojiIcon, serializeEmojiIcon } from "@/lib/emoji-icon";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";

export const AutoFormEmojiIcon = ({
  label,
  labelRight,
  description,
  otherProps: { isOptional },
  field,
  // oxlint-disable-next-line no-unused-vars
  itemParams,
  // oxlint-disable-next-line no-unused-vars
  multiLang,
  ...props
}: ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof EmojiIconPicker>, "onChange" | "value">) => {
  return (
    <>
      {!!label && (
        <AutoFormLabel isOptional={isOptional} labelRight={labelRight}>
          {label}
        </AutoFormLabel>
      )}

      <FormControl>
        <EmojiIconPicker
          onBlur={field.onBlur}
          onChange={value => field.onChange(serializeEmojiIcon(value))}
          value={parseEmojiIcon(
            typeof field.value === "string" ? field.value : undefined,
          )}
          {...props}
        />
      </FormControl>

      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
