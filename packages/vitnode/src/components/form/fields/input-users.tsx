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

/**
 * A person's face, or the space where it will be.
 *
 * A generated avatar needs a colour, and a colour is the one column a caller
 * that only resolved a *name* does not have. Inventing one is not an option -
 * the wrong colour reads as a different person - so the gap is filled with a
 * neutral placeholder rather than left empty.
 *
 * Same box either way, which is the point: the name sits in the same place
 * before and after the real avatar arrives, so nothing jumps sideways when a
 * search fills the colour in.
 */
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
        // Only the initial and the colour are drawn, so a handle the caller
        // never had does not stop the avatar rendering.
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

/**
 * One person as a picker row: a face, a name, and the handle behind it.
 *
 * Exported because "what a person looks like in a list" is a decision, and the
 * to-many people picker in the Content Engine has to make the same one - a set
 * of authors that rendered them differently from the list they were chosen from
 * would read as two different controls.
 */
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

/**
 * Picks one person, by name, for an `AutoForm` field.
 *
 * The author selector, the "assign this to" selector, and every other place a
 * form needs a person rather than a string. The value is the **user id**, so a
 * schema is `z.number()` and the payload needs no unwrapping:
 *
 * ```ts
 * const formSchema = z.object({ authorId: z.number() });
 * ```
 *
 * A picker cannot show a name it has never fetched, so an *edit* form passes the
 * person it already knows about as `selected`. Without it the field would open
 * showing a bare id, or - worse - showing the placeholder as though nothing were
 * chosen. Whatever the search returns is remembered on top of that, so a person
 * picked a moment ago still reads as their name.
 */
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
  /**
   * Offers a way back to *nobody*, for a field that allows it.
   *
   * Off by default: on a required field a clear button is a button whose only
   * outcome is a validation error.
   */
  clearable?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Swap the lookup - a plugin scoping to its own members, or a test. */
  search?: (value: string) => Promise<UserOption[]>;
  searchPlaceholder?: string;
  /** The person the field opens on, for an edit form that already has one. */
  selected?: null | PartialUserOption;
}) => {
  const t = useTranslations("core.global");
  // Everyone this field has *learned* about, from its own searches.
  const [known, setKnown] = React.useState<Record<number, PartialUserOption>>(
    {},
  );

  const value = typeof field.value === "number" ? field.value : null;
  // Only where there is something to clear: on an empty field the button would
  // be an affordance for a state it is already in.
  const clearButton = clearable && value !== null;
  // A search wins over `selected`, because it carries the colour a caller that
  // only resolved a name does not have. `selected` is read on every render
  // rather than seeded into state once: a caller may resolve the person
  // *after* the first paint - the Content Engine does exactly that - and a
  // one-time seed would leave the field showing a placeholder for good.
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

      {/* `relative`, because the clear button sits *inside* the control. It
          cannot be a child of the trigger - that is a `<button>`, and a button
          inside a button is invalid - so it is a sibling laid over the right
          edge, ahead of the chevron. */}
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
