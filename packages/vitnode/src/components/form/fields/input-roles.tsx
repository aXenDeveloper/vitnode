"use client";

import { XIcon } from "lucide-react";
import React from "react";
import { useLocale, useTranslations } from "use-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";

import type { ItemAutoFormComponentProps } from "../auto-form";
import type { RoleOption, RoleSearch } from "./roles";

import { AsyncPicker } from "../common/async-picker";
import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";
import { roleOptionName } from "./roles";

export type { RoleOption, RoleSearch };
export { roleOptionName };

/** What the role field takes. `search` is the whole of its host coupling. */
export type AutoFormRolesProps = ItemAutoFormComponentProps & {
  disabled?: boolean;
  excludeIds?: number[];
  multiple?: boolean;
  placeholder?: string;
  /**
   * Required, and there is no default. See the note on the component below:
   * reading roles is the host's business, and a component that guessed would be
   * a component whose behaviour depended on how it was bundled.
   */
  search: RoleSearch;
  searchPlaceholder?: string;
  selected?: RoleOption[];
};

/**
 * The role field, and it belongs to no framework.
 *
 * Two things used to pin it to Next.js, and both were invisible until something
 * other than Next.js rendered it - which is exactly what `/docs/ui/roles`
 * started doing when the documentation moved to TanStack Start.
 *
 * **`next-intl`.** Its root entry re-exports `use-intl`, so this worked, and
 * that is the trap: a shared component reading it is one a framework-neutral
 * package cannot claim to be framework-neutral about. Every migrated component
 * in this package reads `use-intl` directly, and now so does this one.
 *
 * **The default search.** `search` defaulted to `searchRoles`, a `"use server"`
 * action carrying `server-only` and Next's request scope. Deferring it behind an
 * `await import()` moved the failure from load time to the first keystroke,
 * which is worse rather than better: a host that cannot run the action still
 * cannot run it, and now finds out inside a dropdown.
 *
 * So the dependency is injected and **required**. Reading roles is the host's
 * business: the AdminCP hands over `searchAdminRolesInBrowser`, a browser fetch
 * to Hono, and a host with its own source of roles hands over that instead.
 * There is deliberately no fallback and no environment sniffing - a component
 * that guessed its host would be a component whose behaviour depends on how it
 * was bundled.
 *
 * There was briefly a third option: an adapter beside this file that injected
 * the Server Action as a default. It is gone with the rest of that surface, and
 * it must not come back in the shape of a default parameter here - which is the
 * one thing the boundary test below asserts about a file that no longer exists.
 *
 * `packages/vitnode/src/components/form/fields/roles-boundaries.test.ts` holds
 * all of it.
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
  search,
  searchPlaceholder,
  selected = [],
}: AutoFormRolesProps) => {
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
