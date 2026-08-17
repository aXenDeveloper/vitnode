"use client";

import { XIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";

import type { ItemAutoFormComponentProps } from "../auto-form";
import type { RoleOption } from "./search-roles.action.server";

import { AsyncPicker } from "../common/async-picker";
import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";
import { searchRoles } from "./search-roles.action.server";

export type { RoleOption };

/**
 * A role's name in the reader's language.
 *
 * Falls back to the first translation rather than to the id: a role with no
 * English name is still a role somebody named, and showing `4` helps nobody.
 */
export const roleOptionName = (role: RoleOption, locale: string): string =>
  role.name.find(item => item.languageCode === locale)?.name ??
  role.name[0]?.name ??
  String(role.id);

/**
 * Picks one role, or several, for an `AutoForm` field.
 *
 * One component rather than two, because the difference is the *shape of the
 * value* and nothing else - the search, the colour, the language resolution and
 * the empty state are identical, and two copies is how they drift:
 *
 * ```ts
 * z.object({ roleId: z.number() })                  // multiple omitted
 * z.object({ roleIds: z.array(z.number()).min(1) }) // multiple
 * ```
 *
 * With `multiple` the chosen roles are listed as removable chips and the picker
 * stays open for business - it appends rather than replaces, and picking one
 * that is already there removes it, which is what the tick in the list means.
 *
 * `selected` seeds the names for ids the field starts with, exactly as
 * `AutoFormUser` does and for the same reason: an edit form knows its roles
 * before the picker has searched for anything.
 */
export const AutoFormRoles = ({
  description,
  disabled,
  excludeIds = [],
  field,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  itemParams,
  label,
  labelRight,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  multiLang,
  multiple = false,
  otherProps,
  placeholder,
  search = searchRoles,
  searchPlaceholder,
  selected = [],
}: ItemAutoFormComponentProps & {
  disabled?: boolean;
  /** Roles the picker must not offer - ones another field already owns. */
  excludeIds?: number[];
  /** `number[]` instead of `number`, and a chip list instead of one label. */
  multiple?: boolean;
  placeholder?: string;
  search?: (value: string) => Promise<RoleOption[]>;
  searchPlaceholder?: string;
  /** Roles the field opens on, for an edit form that already has some. */
  selected?: RoleOption[];
}) => {
  const t = useTranslations("core.global");
  const locale = useLocale();
  const [known, setKnown] = React.useState<Record<number, RoleOption>>(() =>
    Object.fromEntries(selected.map(role => [role.id, role])),
  );

  const ids: number[] = multiple
    ? Array.isArray(field.value)
      ? (field.value as number[])
      : []
    : typeof field.value === "number"
      ? [field.value]
      : [];

  const nameOf = (id: number): string => {
    const role = known[id];

    return role ? roleOptionName(role, locale) : String(id);
  };
  const colorOf = (id: number): string | undefined =>
    known[id]?.color ?? undefined;

  const remove = (id: number) => {
    field.onChange(multiple ? ids.filter(item => item !== id) : null);
  };

  const label_ = !!label && (
    <AutoFormLabel isOptional={otherProps.isOptional} labelRight={labelRight}>
      {label}
    </AutoFormLabel>
  );

  const picker = (
    <AsyncPicker<RoleOption>
      disabled={disabled}
      invalid={otherProps["aria-invalid"]}
      onSelect={option => {
        setKnown(seen => ({ ...seen, [option.id]: option }));

        if (!multiple) {
          field.onChange(option.id);

          return;
        }

        // A second pick of the same role removes it, which is what the tick
        // beside it in the list is promising.
        field.onChange(
          ids.includes(option.id)
            ? ids.filter(item => item !== option.id)
            : [...ids, option.id],
        );
      }}
      renderOption={option => (
        <span
          className="truncate font-medium"
          style={option.color ? { color: option.color } : undefined}
        >
          {roleOptionName(option, locale)}
        </span>
      )}
      search={async value =>
        (await search(value)).filter(role => !excludeIds.includes(role.id))
      }
      searchPlaceholder={searchPlaceholder}
      selectedIds={ids}
      trigger={
        !multiple && ids.length > 0 ? (
          <span
            className="truncate font-medium"
            style={colorOf(ids[0]) ? { color: colorOf(ids[0]) } : undefined}
          >
            {nameOf(ids[0])}
          </span>
        ) : (
          <span className="text-muted-foreground truncate">
            {placeholder ?? t("select_option")}
          </span>
        )
      }
    />
  );

  if (!multiple) {
    return (
      <>
        {label_}
        {picker}
        {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
        <FormMessage />
      </>
    );
  }

  return (
    <>
      {label_}

      {ids.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {ids.map(id => (
            <li key={id}>
              <Badge className="gap-1 pe-1" variant="outline">
                <span style={colorOf(id) ? { color: colorOf(id) } : undefined}>
                  {nameOf(id)}
                </span>
                <Button
                  aria-label={t("remove")}
                  className="size-4"
                  disabled={disabled}
                  onClick={() => {
                    remove(id);
                  }}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <XIcon aria-hidden />
                </Button>
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {picker}
      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
