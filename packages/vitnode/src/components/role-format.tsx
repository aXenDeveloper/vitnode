import { getLocale } from "next-intl/server";

import { cn } from "@/lib/utils";

export const RoleFormat = async ({
  role,
  className,
  style,
  ...props
}: Omit<React.ComponentProps<"span">, "role"> & {
  role: {
    color: null | string;
    id: number;
    name: { languageCode: string; name: string }[];
  };
}) => {
  // `getLocale()` resolves to the active locale (the config's `defaultLocale`
  // when the request has none), so match it against the translations and fall
  // back to whatever translation exists.
  const locale = await getLocale();
  const name =
    role.name.find(item => item.languageCode === locale)?.name ??
    role.name[0]?.name ??
    "";

  return (
    <span
      className={cn("font-medium", className)}
      style={{ ...(role.color ? { color: role.color } : {}), ...style }}
      {...props}
    >
      {name}
    </span>
  );
};
