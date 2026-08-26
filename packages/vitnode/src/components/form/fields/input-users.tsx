"use client";

import { UserIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";

import type { ItemAutoFormComponentProps } from "../auto-form";
import type { UserOption } from "./search-users.action.server";

import { AsyncPicker } from "../common/async-picker";
import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";
import { searchUsers } from "./search-users.action.server";

export type { UserOption };

/**
 * A person the field can label but has not necessarily fetched.
 *
 * `avatarColor` is optional because the caller often knows only a name and an
 * id - the Content Engine resolves a `user` field's label alongside the record
 * and never carries a colour with it.
 */
export type PartialUserOption = Omit<UserOption, "avatarColor" | "nameCode"> &
  Partial<Pick<UserOption, "avatarColor" | "nameCode">>;

const UserAvatar = ({
  size,
  user,
}: {
  size: number;
  user: PartialUserOption;
}) =>
  user.avatarColor ? (
    <Avatar
      size={size}
      user={{
        avatarColor: user.avatarColor,
        name: user.name,
        nameCode: user.nameCode ?? "",
      }}
    />
  ) : (
    <span
      aria-hidden
      className="bg-muted text-muted-foreground flex shrink-0 items-center justify-center rounded-full"
      style={{ height: size, width: size }}
    >
      <UserIcon style={{ height: size * 0.6, width: size * 0.6 }} />
    </span>
  );

export const UserOptionRow = ({
  size = 24,
  user,
}: {
  size?: number;
  user: PartialUserOption;
}) => (
  <div className="flex min-w-0 items-center gap-2">
    <UserAvatar size={size} user={user} />
    <span className="truncate font-medium">{user.name}</span>
    {!!user.nameCode && (
      <span className="text-muted-foreground truncate text-sm">
        @{user.nameCode}
      </span>
    )}
  </div>
);

export const AutoFormUser = ({
  clearable = false,
  description,
  disabled,
  field,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  itemParams,
  label,
  labelRight,
  // Language-aware inputs only - dropped so it never reaches the DOM.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  multiLang,
  otherProps,
  placeholder,
  search = searchUsers,
  searchPlaceholder,
  selected,
}: ItemAutoFormComponentProps & {
  className?: string;
  clearable?: boolean;
  disabled?: boolean;
  placeholder?: string;
  search?: (value: string) => Promise<UserOption[]>;
  searchPlaceholder?: string;
  selected?: null | PartialUserOption;
}) => {
  const t = useTranslations("core.global");
  const [known, setKnown] = React.useState<Record<number, PartialUserOption>>(
    {},
  );

  const value = typeof field.value === "number" ? field.value : null;
  const clearButton = clearable && value !== null;
  const current =
    value === null
      ? null
      : (known[value] ?? (selected?.id === value ? selected : null));

  return (
    <>
      {!!label && (
        <AutoFormLabel
          isOptional={otherProps.isOptional}
          labelRight={labelRight}
        >
          {label}
        </AutoFormLabel>
      )}

      <div className="relative w-full">
        <AsyncPicker<UserOption>
          disabled={disabled}
          invalid={otherProps["aria-invalid"]}
          onSelect={option => {
            setKnown(seen => ({ ...seen, [option.id]: option }));
            field.onChange(option.id);
          }}
          renderOption={option => <UserOptionRow user={option} />}
          search={search}
          searchPlaceholder={searchPlaceholder}
          selectedIds={value === null ? [] : [value]}
          trigger={
            current ? (
              <span
                className={cn(
                  "flex min-w-0 items-center gap-2",
                  clearButton && "me-8",
                )}
              >
                <UserAvatar size={20} user={current} />
                <span className="truncate">{current.name}</span>
              </span>
            ) : (
              <span className="text-muted-foreground truncate">
                {placeholder ?? t("select_option")}
              </span>
            )
          }
        />

        {clearButton && (
          <Button
            aria-label={t("remove")}
            className="absolute end-8 top-1/2 size-6 -translate-y-1/2"
            disabled={disabled}
            onClick={() => {
              field.onChange(null);
            }}
            size="icon"
            type="button"
            variant="ghost"
          >
            <XIcon aria-hidden className="size-4" />
          </Button>
        )}
      </div>

      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
