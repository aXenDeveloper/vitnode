"use client";

import { useLocale } from "use-intl";

import { cn } from "@/lib/utils";

import type { RoleNameEntry } from "./role-name";

import { resolveRoleName } from "./role-name";

/**
 * A role's name, coloured by the role, in the reader's language.
 *
 * The framework-neutral half of `RoleFormat`. That component is an async Server
 * Component built on `next-intl/server`'s `getLocale()`, which is fine in a
 * Next.js RSC tree and impossible anywhere else - so every AdminCP table that
 * renders a role was Next-only for the sake of one string lookup.
 *
 * This reads the locale from `use-intl`'s context instead, which both
 * applications provide: `NextIntlClientProvider` is built on it, and the
 * TanStack routes mount `RouteMessages`. The cost is that it is a client
 * component, which it would have to be in either framework the moment the table
 * around it is.
 *
 * `RoleFormat` stays where it is, unchanged, for the Next.js pages that are not
 * migrating yet and for the plugins documented against it.
 */
export const RoleFormatContent = ({
  className,
  role,
  style,
  ...props
}: Omit<React.ComponentProps<"span">, "role"> & {
  role: {
    color: null | string;
    id: number;
    name: RoleNameEntry[];
  };
}) => {
  const locale = useLocale();

  return (
    <span
      className={cn("font-medium", className)}
      style={{ ...(role.color ? { color: role.color } : {}), ...style }}
      {...props}
    >
      {resolveRoleName(role, locale)}
    </span>
  );
};
