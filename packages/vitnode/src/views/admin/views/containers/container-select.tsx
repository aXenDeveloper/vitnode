import { useTranslations } from "use-intl";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";

import { AutoFormDesc } from "@/components/form/common/desc";
import { AutoFormLabel } from "@/components/form/common/label";
import { FormControl, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { AdminContentContainer } from "./container-request";

/** One entry per level above a row of `depth` - `[1, 2]` for depth 3 - for its indent guides. */
export const containerGuideLevels = (depth: number): number[] =>
  Array.from({ length: Math.max(0, depth - 1) }, (_, at) => at + 1);

/** The key the select holds for "no container" / "top level". */
const NONE = "__none__";

export interface ContainerSelectOption {
  depth: number;
  /** `null` is the "no container" / "top level" choice. */
  id: null | number;
  label: string;
}

/** Records in tree order, as options that keep their depth. */
export const containerSelectOptions = (
  records: readonly Pick<AdminContentContainer, "depth" | "id" | "name">[],
): ContainerSelectOption[] =>
  records.map(record => ({
    depth: record.depth,
    id: record.id,
    label: record.name,
  }));

const keyOf = (id: null | number) => (id === null ? NONE : String(id));

/**
 * A select over a container tree. Each option is indented by its depth, so the
 * list reads as the tree it is; the trigger shows the bare name. The field holds
 * the container's id - a number - or `null`.
 */
export const AutoFormContainerSelect = ({
  description,
  disabled,
  field,
  label,
  labelRight,
  options,
  otherProps: { isOptional },
  placeholder,
}: Pick<
  ItemAutoFormComponentProps,
  "description" | "field" | "label" | "labelRight" | "otherProps"
> & {
  disabled?: boolean;
  options: readonly ContainerSelectOption[];
  placeholder?: string;
}) => {
  const t = useTranslations("core.global");
  const items = options.map(option => ({
    label: option.label,
    value: keyOf(option.id),
  }));
  const current = field.value as null | number | undefined;
  const value =
    current === null || current === undefined
      ? options.some(option => option.id === null)
        ? NONE
        : null
      : String(current);

  return (
    <>
      {!!label && (
        <AutoFormLabel isOptional={isOptional} labelRight={labelRight}>
          {label}
        </AutoFormLabel>
      )}

      <FormControl>
        <Select
          disabled={disabled}
          items={items}
          onValueChange={next => {
            if (typeof next !== "string") return;
            field.onChange(next === NONE ? null : Number(next));
          }}
          value={value}
        >
          <SelectTrigger className="w-full" onBlur={field.onBlur}>
            <SelectValue placeholder={placeholder ?? t("select_option")} />
          </SelectTrigger>

          <SelectContent>
            {options.map(option => (
              <SelectItem key={keyOf(option.id)} value={keyOf(option.id)}>
                {containerGuideLevels(option.depth).map(level => (
                  <span
                    aria-hidden
                    className="border-border ms-1 w-3 shrink-0 self-stretch border-s"
                    key={level}
                  />
                ))}
                <span className="truncate">{option.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormControl>

      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
