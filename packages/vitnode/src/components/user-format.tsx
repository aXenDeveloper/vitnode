import { Link } from "@tanstack/react-router";
import { cn } from "cn";

import { parseEmojiIcon } from "@/lib/emoji-icon";

import { EmojiIcon } from "./ui/emoji-icon";

/** The path of a user's public profile page. */
export const userProfileHref = (nameCode: string): string =>
  `/users/${encodeURIComponent(nameCode)}`;

/**
 * A user's name, optionally styled by their role and linked to their profile.
 * Shows `user.fullName` in place of the nickname when the API sends one.
 */
export const UserFormat = ({
  user,
  format,
  link,
  className,
  style,
  ...props
}: React.ComponentProps<"span"> & {
  /** Colors the name and adds the role's prefix icon. */
  format?: boolean;
  /** Links to the profile page; needs `user.nameCode`. */
  link?: boolean;
  user: {
    /** The real name the member chose to show; the API sends `null` otherwise. */
    fullName?: null | string;
    name: string;
    nameCode?: string;
    role: {
      color: null | string;
      prefix?: null | string;
    };
  };
}) => {
  const prefix = format ? parseEmojiIcon(user.role.prefix) : null;
  const classes = cn(
    "inline-flex min-w-0 items-center gap-1.5 font-medium",
    className,
  );
  const colorStyle = {
    ...(format && user.role.color ? { color: user.role.color } : {}),
    ...style,
  };
  const content = (
    <>
      {!!prefix && <EmojiIcon value={prefix} />}
      <span className="truncate">{user.fullName ?? user.name}</span>
    </>
  );

  if (link && user.nameCode) {
    return (
      <Link
        className={cn(
          classes,
          "focus-visible:ring-ring/50 rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3",
        )}
        style={colorStyle}
        title={props.title}
        to={userProfileHref(user.nameCode)}
      >
        {content}
      </Link>
    );
  }

  return (
    <span className={classes} style={colorStyle} {...props}>
      {content}
    </span>
  );
};
