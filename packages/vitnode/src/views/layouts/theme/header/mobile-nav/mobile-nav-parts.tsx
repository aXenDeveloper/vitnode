import { Link, useMatchRoute } from "@tanstack/react-router";
import { cn } from "cn";
import React from "react";

import { EmojiIcon } from "@/components/ui/emoji-icon";
import { parseEmojiIcon } from "@/lib/emoji-icon";
import { isExternalNavigationHref } from "@/lib/navigation";

import type { HeaderNavChildItem } from "../header-nav";

export const useIsMobileNavHrefActive = () => {
  const matchRoute = useMatchRoute();

  return (href: string): boolean =>
    !isExternalNavigationHref(href) &&
    Boolean(matchRoute({ fuzzy: href !== "/", to: href }));
};

export const MobileNavIcon = ({
  className,
  icon,
  label,
}: {
  className?: string;
  icon: string | undefined;
  label: string;
}) => {
  const parsed = parseEmojiIcon(icon);

  if (parsed) return <EmojiIcon className={className} value={parsed} />;

  return (
    <span
      aria-hidden
      className={cn(
        "grid place-items-center rounded-md border border-current text-xs leading-none font-semibold",
        className,
      )}
    >
      {label.trim().charAt(0).toLocaleUpperCase()}
    </span>
  );
};

export const MobileNavLink = ({
  children,
  item,
  onNavigate,
  ...props
}: Omit<React.ComponentProps<"a">, "href" | "rel" | "target"> & {
  item: Pick<HeaderNavChildItem, "href" | "isOpenInNewTab">;
  onNavigate?: () => void;
}) => {
  const target = item.isOpenInNewTab ? "_blank" : undefined;
  const rel = item.isOpenInNewTab ? "noopener noreferrer" : undefined;

  if (isExternalNavigationHref(item.href)) {
    return (
      <a
        href={item.href}
        onClick={onNavigate}
        rel={rel}
        target={target}
        {...props}
      >
        {children}
      </a>
    );
  }

  return (
    <Link
      onClick={onNavigate}
      rel={rel}
      target={target}
      to={item.href}
      {...props}
    >
      {children}
    </Link>
  );
};
