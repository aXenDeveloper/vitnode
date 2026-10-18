import type React from "react";

import { EmojiIconPicker } from "@/components/ui/emoji-icon-picker";
import { FormControl, FormMessage } from "@/components/ui/form";
import { parseEmojiIcon, serializeEmojiIcon } from "@/lib/emoji-icon";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";

/**
 * An emoji or Lucide icon picker for an `AutoForm` string field. Stores
 * `emoji:<emoji>` or `icon:<lucide-name>`, or `""` when cleared. Spread the
 * props `AutoForm` passes and add a `label`.
 */
export const AutoFormEmojiIcon = ({
  label,
  labelRight,
  description,
  tip,
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
        <AutoFormLabel
          isOptional={isOptional}
          labelRight={labelRight}
          tip={tip}
        >
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
