import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import React from "react";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { UserPreviewSkeleton } from "./user-preview-skeleton";
import { userProfileHref } from "./user-profile-href";

const loadUserPreviewCard = async () => await import("./user-preview-card");

const UserPreviewCard = React.lazy(async () => {
  const module = await loadUserPreviewCard();

  return { default: module.UserPreviewCard };
});

/**
 * A link to a member's profile that opens a preview card - cover, avatar,
 * name, group, headline and presence - after the pointer rests on it or it
 * gets keyboard focus. The card fetches the public profile itself when it
 * opens (shared with the profile page's cache), so pass only the `nameCode`.
 * Touch taps follow the link. Universal.
 *
 * `UserFormat` with `link` already uses it; reach for it directly to give an
 * avatar or any other element the same card.
 *
 * @example
 * ```tsx
 * import { Avatar } from "@vitnode/core/components/avatar";
 * import { UserPreview } from "@vitnode/core/components/user-preview";
 *
 * <UserPreview decorative nameCode={user.nameCode}>
 *   <Avatar alt="" size={32} user={user} />
 * </UserPreview>;
 * ```
 */
export const UserPreview = ({
  children,
  className,
  decorative = false,
  nameCode,
  style,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  /**
   * Hides the link from screen readers and the tab order, for a duplicate of
   * a linked name right beside it - an avatar, usually. Pointer users still
   * get the card. Defaults to `false`.
   */
  decorative?: boolean;
  /** The member's URL name: the link target and the profile to load. */
  nameCode: string;
  style?: React.CSSProperties;
  title?: string;
}) => {
  const [open, setOpen] = React.useState(false);

  return (
    <HoverCard onOpenChange={setOpen} open={open}>
      <HoverCardTrigger
        closeDelay={150}
        delay={400}
        onPointerEnter={() => {
          void loadUserPreviewCard();
        }}
        render={
          <Link
            aria-hidden={decorative || undefined}
            className={cn(
              "focus-visible:ring-ring/50 rounded-sm outline-none focus-visible:ring-3",
              className,
            )}
            style={style}
            tabIndex={decorative ? -1 : undefined}
            title={title}
            to={userProfileHref(nameCode)}
          />
        }
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        className="w-72 overflow-hidden p-0 sm:w-80"
        side="bottom"
      >
        {open ? (
          <React.Suspense fallback={<UserPreviewSkeleton />}>
            <UserPreviewCard nameCode={nameCode} />
          </React.Suspense>
        ) : null}
      </HoverCardContent>
    </HoverCard>
  );
};
