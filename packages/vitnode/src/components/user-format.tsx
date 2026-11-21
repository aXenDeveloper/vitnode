import { Link } from "@tanstack/react-router";
import { parseEmojiIcon } from "@vitnode/api/lib/emoji-icon";
import { cn } from "cn";

import { Avatar } from "./avatar";
import { EmojiIcon } from "./ui/emoji-icon";
import { UserPreview } from "./user-preview";
import { userProfileHref } from "./user-profile-href";

export { userProfileHref } from "./user-profile-href";

const FALLBACK_AVATAR_COLOR = "64748b";

/**
 * A user's name, optionally styled by their role, led by their avatar and
 * linked to their profile. Shows `user.fullName` in place of the nickname when
 * the API sends one. A linked name previews the member's profile - a hover
 * card with a mouse, a bottom sheet on touch screens - which fetches its own
 * data.
 */
export const UserFormat = ({
  user,
  avatar = false,
  avatarSize = 20,
  format,
  link,
  preview = true,
  className,
  style,
  ...props
}: React.ComponentProps<"span"> & {
  /**
   * Puts the member's avatar before the name: `user.avatarUrl`, or a letter
   * on `user.avatarColor` (slate when that is missing too), in place of the
   * role's prefix icon. Defaults to `false`.
   */
  avatar?: boolean;
  /** The avatar's width and height in pixels. Defaults to `20`. */
  avatarSize?: number;
  /** Colors the name and adds the role's prefix icon, unless `avatar` is set. */
  format?: boolean;
  /** Links to the profile page; needs `user.nameCode`. */
  link?: boolean;
  /**
   * With `link`, previews the member's profile: a hover card when the link is
   * hovered or focused, a bottom sheet when it is tapped on a touch screen
   * (the tap then opens the sheet instead of the profile). Turn it off inside
   * another hover card. Defaults to `true`.
   */
  preview?: boolean;
  user: {
    /** The letter avatar's background, a hex color without `#`. */
    avatarColor?: string;
    /** The uploaded avatar, shown with `avatar`. */
    avatarUrl?: null | string;
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
  const prefix = format && !avatar ? parseEmojiIcon(user.role.prefix) : null;
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
      {avatar ? (
        <Avatar
          alt=""
          className="shrink-0"
          size={avatarSize}
          style={{ height: avatarSize, width: avatarSize }}
          user={{
            avatarColor: user.avatarColor ?? FALLBACK_AVATAR_COLOR,
            avatarUrl: user.avatarUrl,
            name: user.name,
            nameCode: user.nameCode ?? user.name,
          }}
        />
      ) : null}
      {!!prefix && <EmojiIcon value={prefix} />}
      <span className="truncate">{user.fullName ?? user.name}</span>
    </>
  );

  if (link && user.nameCode && preview) {
    return (
      <UserPreview
        className={cn(classes, "underline-offset-4 hover:underline")}
        nameCode={user.nameCode}
        style={colorStyle}
        title={props.title}
      >
        {content}
      </UserPreview>
    );
  }

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
