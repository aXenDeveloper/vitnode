import { Link, useMatchRoute } from "@tanstack/react-router";
import { cn } from "cn";

import { EmojiIcon } from "@/components/ui/emoji-icon";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { parseEmojiIcon } from "@/lib/emoji-icon";
import { isExternalNavigationHref } from "@/lib/navigation";

import type { HeaderNavItem } from "./header-nav";

const navLinkRender = ({
  href,
  isOpenInNewTab,
}: Pick<HeaderNavItem, "href" | "isOpenInNewTab">) => {
  const target = isOpenInNewTab ? "_blank" : undefined;
  const rel = isOpenInNewTab ? "noopener noreferrer" : undefined;

  if (isExternalNavigationHref(href)) {
    return <a href={href} rel={rel} target={target} />;
  }

  return <Link rel={rel} target={target} to={href} />;
};

/**
 * Whether a click landed on the chevron rather than on the rest of the item.
 *
 * Measured rather than read off `event.target`: a parent is one anchor - a
 * chevron of its own would be a button inside a link - and while the dropdown
 * is open the trigger covers itself with a pseudo-element that bridges the gap
 * to the popup, so every click reports the anchor as its target.
 *
 * A keyboard "click" carries no coordinates, lands at the origin, and so
 * follows the link, which is what Enter on a link should do.
 */
const CHEVRON_HIT_PADDING = 4;

const isChevronClick = (event: React.MouseEvent<HTMLElement>): boolean => {
  const chevron = event.currentTarget.querySelector(
    '[data-slot="navigation-menu-chevron"]',
  );
  if (!chevron) return false;

  const { bottom, left, right, top } = chevron.getBoundingClientRect();

  return (
    event.clientX >= left - CHEVRON_HIT_PADDING &&
    event.clientX <= right + CHEVRON_HIT_PADDING &&
    event.clientY >= top - CHEVRON_HIT_PADDING &&
    event.clientY <= bottom + CHEVRON_HIT_PADDING
  );
};

const NavIcon = ({
  className,
  icon,
}: {
  className?: string;
  icon: string | undefined;
}) => <EmojiIcon className={className} value={parseEmojiIcon(icon)} />;

const HeaderNavEntry = ({ item }: { item: HeaderNavItem }) => {
  const matchRoute = useMatchRoute();
  const isActive = (href: string): boolean =>
    !isExternalNavigationHref(href) && Boolean(matchRoute({ to: href }));

  if (!item.items?.length) {
    return (
      <NavigationMenuItem>
        <NavigationMenuLink
          active={isActive(item.href)}
          className={cn(
            navigationMenuTriggerStyle(),
            "text-muted-foreground hover:text-foreground data-active:text-foreground gap-2",
          )}
          render={navLinkRender(item)}
        >
          <NavIcon className="size-4" icon={item.icon} />
          {item.label}
        </NavigationMenuLink>
      </NavigationMenuItem>
    );
  }

  return (
    <NavigationMenuItem>
      {/* A parent is a destination as well as a dropdown: it opens on hover and
          follows its own href on click. */}
      <NavigationMenuTrigger
        className={cn(
          "text-muted-foreground hover:text-foreground data-popup-open:text-foreground gap-2",
          isActive(item.href) && "text-foreground",
        )}
        nativeButton={false}
        onClickCapture={event => {
          if (isChevronClick(event)) event.preventDefault();
        }}
        render={navLinkRender(item)}
        // It navigates, so it is announced as the link it is. `aria-expanded`
        // is allowed on a link and still says the dropdown is there.
        role="link"
      >
        <NavIcon className="size-4" icon={item.icon} />
        {item.label}
      </NavigationMenuTrigger>

      <NavigationMenuContent>
        <ul className="flex w-64 flex-col gap-1">
          {item.items.map(child => (
            <li key={child.id}>
              <NavigationMenuLink
                active={isActive(child.href)}
                className="items-start"
                render={navLinkRender(child)}
              >
                <NavIcon
                  className="text-muted-foreground mt-0.5 size-4 shrink-0"
                  icon={child.icon}
                />

                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">{child.label}</span>
                  {child.description ? (
                    <span className="text-muted-foreground text-xs leading-relaxed text-pretty">
                      {child.description}
                    </span>
                  ) : null}
                </span>
              </NavigationMenuLink>
            </li>
          ))}
        </ul>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
};

export const HeaderNavMenu = ({
  className,
  navigation,
}: {
  className?: string;
  navigation: HeaderNavItem[];
}) => (
  <NavigationMenu className={cn("hidden sm:flex", className)}>
    <NavigationMenuList>
      {navigation.map(item => (
        <HeaderNavEntry item={item} key={item.id} />
      ))}
    </NavigationMenuList>
  </NavigationMenu>
);
