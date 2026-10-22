import { cn } from "cn";
import { useLocale } from "use-intl";

import { parseEmojiIcon } from "@/lib/emoji-icon";

import type { RoleNameEntry } from "./role-name";

import { resolveRoleName } from "./role-name";
import { EmojiIcon } from "./ui/emoji-icon";

/**
 * A role's name in the current language (else its first name, else its id),
 * in the role's color, after its emoji or icon prefix. Extra props go to the
 * outer `<span>`.
 */
export const RoleFormat = ({
  className,
  role,
  style,
  ...props
}: Omit<React.ComponentProps<"span">, "role"> & {
  role: {
    color: null | string;
    id: number;
    name: RoleNameEntry[];
    prefix?: null | string;
  };
}) => {
  const locale = useLocale();
  const prefix = parseEmojiIcon(role.prefix);

  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 font-medium",
        className,
      )}
      style={{ ...(role.color ? { color: role.color } : {}), ...style }}
      {...props}
    >
      {!!prefix && <EmojiIcon value={prefix} />}
      <span className="truncate">{resolveRoleName(role, locale)}</span>
    </span>
  );
};
