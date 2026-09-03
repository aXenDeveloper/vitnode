"use client";

import { useLocale } from "use-intl";

import { cn } from "@/lib/utils";

import type { RoleNameEntry } from "./role-name";

import { resolveRoleName } from "./role-name";

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
