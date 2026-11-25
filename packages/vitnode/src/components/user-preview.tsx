import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { cn } from "cn";
import React from "react";

import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
import { userProfileQueryOptions } from "@/views/profile/profile-query";

import type { UserPreviewSurface } from "./user-preview-card";

import { Drawer, DrawerContent, DrawerTrigger } from "./ui/drawer";
import {
  createHoverCardHandle,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  HoverCardViewport,
} from "./ui/hover-card";
import {
  UserPreviewHandleContext,
  type UserPreviewPayload,
} from "./user-preview-context";
import { UserPreviewSkeleton } from "./user-preview-skeleton";
import { userProfileHref } from "./user-profile-href";

const loadUserPreviewCard = async () => await import("./user-preview-card");

const UserPreviewCard = React.lazy(async () => {
  const module = await loadUserPreviewCard();

  return { default: module.UserPreviewCard };
});

interface UserPreviewProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Hides the trigger from screen readers and the tab order, for a duplicate
   * of a linked name right beside it - an avatar, usually. Pointer and touch
   * users still get the preview. Defaults to `false`.
   */
  decorative?: boolean;
  /** The member's URL name: the profile to link to and to load. */
  nameCode: string;
  style?: React.CSSProperties;
  title?: string;
}

const PreviewContent = ({
  nameCode,
  surface,
}: {
  nameCode: string;
  surface: UserPreviewSurface;
}) => (
  <React.Suspense fallback={<UserPreviewSkeleton />}>
    <UserPreviewCard nameCode={nameCode} surface={surface} />
  </React.Suspense>
);

const useWarmPreview = (nameCode: string) => {
  const queryClient = useQueryClient();

  return () => {
    void loadUserPreviewCard();
    void queryClient
      .query(userProfileQueryOptions({ nameCode }))
      .catch(() => undefined);
  };
};

const UserPreviewPopup = ({ nameCode }: { nameCode: string | undefined }) => (
  <HoverCardContent
    align="start"
    className="w-72 overflow-hidden p-0 sm:w-80"
    side="bottom"
  >
    <HoverCardViewport>
      {nameCode ? (
        <PreviewContent key={nameCode} nameCode={nameCode} surface="card" />
      ) : null}
    </HoverCardViewport>
  </HoverCardContent>
);

const UserPreviewHoverCard = ({
  children,
  className,
  decorative,
  nameCode,
  style,
  title,
}: UserPreviewProps) => {
  const handle = React.use(UserPreviewHandleContext);
  const warmPreview = useWarmPreview(nameCode);

  const trigger = (
    <HoverCardTrigger
      closeDelay={150}
      delay={400}
      handle={handle ?? undefined}
      onFocus={warmPreview}
      onPointerEnter={warmPreview}
      payload={{ nameCode }}
      render={
        <Link
          aria-hidden={decorative ? true : undefined}
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
  );

  if (handle) return trigger;

  return (
    <HoverCard>
      {trigger}
      <UserPreviewPopup nameCode={nameCode} />
    </HoverCard>
  );
};

const UserPreviewSheet = ({
  children,
  className,
  decorative,
  nameCode,
  style,
  title,
}: UserPreviewProps) => {
  const router = useRouter();
  const warmPreview = useWarmPreview(nameCode);
  const [open, setOpen] = React.useState(false);

  React.useEffect(
    () =>
      router.subscribe("onBeforeNavigate", () => {
        setOpen(false);
      }),
    [router],
  );

  const [hasOpened, setHasOpened] = React.useState(false);

  return (
    <Drawer
      onOpenChange={next => {
        setOpen(next);
        if (next) setHasOpened(true);
      }}
      open={open}
    >
      <DrawerTrigger asChild>
        <button
          aria-haspopup="dialog"
          aria-hidden={decorative ? true : undefined}
          className={cn(
            "focus-visible:ring-ring/50 cursor-pointer touch-manipulation rounded-sm text-start outline-none focus-visible:ring-3",
            className,
          )}
          onFocus={warmPreview}
          onPointerDown={warmPreview}
          style={style}
          tabIndex={decorative ? -1 : undefined}
          title={title}
          type="button"
        >
          {children}
        </button>
      </DrawerTrigger>
      <DrawerContent
        aria-describedby={undefined}
        className="overflow-hidden"
        handle={false}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-2.5 z-10 mx-auto h-1.5 w-12 rounded-full bg-black/25 dark:bg-white/40"
        />
        <div className="mx-auto w-full max-w-md overflow-y-auto">
          {hasOpened ? (
            <PreviewContent nameCode={nameCode} surface="sheet" />
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

/**
 * A link to a member's profile that previews it: cover, avatar with online
 * status, name, primary role, reputation, join date and last visit - plus the
 * member's warning summary for moderators. With a mouse it opens as a hover
 * card after the pointer rests on it or it gets keyboard focus; on touch
 * screens a tap opens it as a swipeable bottom sheet with a "View profile"
 * button. The preview fetches the public profile itself (shared with the
 * profile page's cache), so pass only the `nameCode`. Universal; renders the
 * link on the server and switches to the sheet trigger after hydration on
 * touch devices.
 *
 * `UserFormat` with `link` already uses it; reach for it directly to give an
 * avatar or any other element the same preview. Under a `UserPreviewProvider`
 * (`VitNodeRootProviders` renders one) the hover card is shared with every
 * other preview instead of mounted per link.
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
export const UserPreview = (props: UserPreviewProps) =>
  useCoarsePointer() ? (
    <UserPreviewSheet {...props} />
  ) : (
    <UserPreviewHoverCard {...props} />
  );

/**
 * Shares one hover card between every `UserPreview` below it: each preview
 * becomes a detached trigger that hands the card its `nameCode`, so a feed
 * with hundreds of names mounts a single card, and moving the pointer from one
 * name to the next glides the card over and cross-fades to the new member
 * instead of closing and reopening it. Without a provider each `UserPreview`
 * falls back to a card of its own.
 * `VitNodeRootProviders` already renders one around the app; render another
 * inside a modal dialog or sheet so the card belongs to it and pressing the
 * card doesn't dismiss the dialog. Universal.
 *
 * @example
 * ```tsx
 * import { SheetContent } from "@vitnode/core/components/ui/sheet";
 * import { UserPreviewProvider } from "@vitnode/core/components/user-preview";
 *
 * <SheetContent>
 *   <UserPreviewProvider>{members}</UserPreviewProvider>
 * </SheetContent>;
 * ```
 */
export const UserPreviewProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const router = useRouter();
  const [handle] = React.useState(() =>
    createHoverCardHandle<UserPreviewPayload>(),
  );

  React.useEffect(
    () =>
      router.subscribe("onBeforeNavigate", () => {
        handle.close();
      }),
    [handle, router],
  );

  return (
    <UserPreviewHandleContext value={handle}>
      {children}
      <HoverCard handle={handle}>
        {({ payload }) => <UserPreviewPopup nameCode={payload?.nameCode} />}
      </HoverCard>
    </UserPreviewHandleContext>
  );
};
