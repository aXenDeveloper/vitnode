import { Link, useMatchRoute } from "@tanstack/react-router";
import { cn } from "cn";
import { ChevronDownIcon } from "lucide-react";
import React from "react";

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
import { Skeleton } from "@/components/ui/skeleton";
import { parseEmojiIcon } from "@/lib/emoji-icon";
import { isExternalNavigationHref } from "@/lib/navigation";

import type { HeaderNavChildItem, HeaderNavItem } from "./header-nav";

import { visibleHeaderNavCount } from "./header-nav";

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

const useIsNavHrefActive = () => {
  const matchRoute = useMatchRoute();

  return (href: string): boolean =>
    !isExternalNavigationHref(href) && Boolean(matchRoute({ to: href }));
};

const HeaderNavDropdownLink = ({ item }: { item: HeaderNavChildItem }) => {
  const isActive = useIsNavHrefActive();

  return (
    <NavigationMenuLink
      active={isActive(item.href)}
      className="items-start"
      render={navLinkRender(item)}
    >
      <NavIcon
        className="text-muted-foreground mt-0.5 size-4 shrink-0"
        icon={item.icon}
      />

      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium">{item.label}</span>
        {item.description ? (
          <span className="text-muted-foreground text-xs leading-relaxed text-pretty">
            {item.description}
          </span>
        ) : null}
      </span>
    </NavigationMenuLink>
  );
};

const HeaderNavEntry = ({ item }: { item: HeaderNavItem }) => {
  const isActive = useIsNavHrefActive();

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
              <HeaderNavDropdownLink item={child} />
            </li>
          ))}
        </ul>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
};

const HeaderNavMoreEntry = ({
  items,
  label,
}: {
  items: HeaderNavItem[];
  label: string;
}) => {
  const isActive = useIsNavHrefActive();
  const hasActiveItem = items.some(
    item =>
      isActive(item.href) || item.items?.some(child => isActive(child.href)),
  );

  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger
        className={cn(
          "text-muted-foreground hover:text-foreground data-popup-open:text-foreground gap-2",
          hasActiveItem && "text-foreground",
        )}
      >
        {label}
      </NavigationMenuTrigger>

      <NavigationMenuContent>
        <ul className="flex w-64 flex-col gap-1">
          {items.map(item => (
            <li className="flex flex-col gap-1" key={item.id}>
              <HeaderNavDropdownLink item={item} />

              {item.items?.length ? (
                <ul className="ms-4 flex flex-col gap-1 border-s ps-2">
                  {item.items.map(child => (
                    <li key={child.id}>
                      <HeaderNavDropdownLink item={child} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
};

const MeasuredNavLabel = ({
  hasDropdown,
  icon,
  label,
}: {
  hasDropdown: boolean;
  icon?: string;
  label: string;
}) => (
  <span className={cn(navigationMenuTriggerStyle(), "gap-2")}>
    <NavIcon className="size-4" icon={icon} />
    {label}
    {hasDropdown ? (
      <>
        {" "}
        <ChevronDownIcon className="ms-1 size-3 shrink-0" />
      </>
    ) : null}
  </span>
);

const MEASURE_ITEM_SELECTOR = '[data-nav-measure="item"]';
const MEASURE_MORE_SELECTOR = '[data-nav-measure="more"]';

const useVisibleNavCount = (navigation: HeaderNavItem[]) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = React.useState<null | number>(null);

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const widthOf = (element: Element | null) =>
      element?.getBoundingClientRect().width ?? 0;

    const update = () => {
      setVisibleCount(
        visibleHeaderNavCount({
          availableWidth: container.clientWidth,
          gap: Number.parseFloat(getComputedStyle(measure).columnGap) || 0,
          itemWidths: [...measure.querySelectorAll(MEASURE_ITEM_SELECTOR)].map(
            widthOf,
          ),
          moreWidth: widthOf(measure.querySelector(MEASURE_MORE_SELECTOR)),
        }),
      );
    };

    const resize = new ResizeObserver(update);
    resize.observe(container);
    resize.observe(measure);

    return () => {
      resize.disconnect();
    };
  }, [navigation]);

  return { containerRef, measureRef, visibleCount };
};

export const HeaderNavMenu = ({
  className,
  moreLabel,
  navigation,
}: {
  className?: string;
  moreLabel: string;
  navigation: HeaderNavItem[];
}) => {
  const { containerRef, measureRef, visibleCount } =
    useVisibleNavCount(navigation);
  const visibleItems =
    visibleCount === null ? navigation : navigation.slice(0, visibleCount);
  const overflowItems =
    visibleCount === null ? [] : navigation.slice(visibleCount);

  return (
    <div
      className={cn(
        "relative hidden min-w-0 flex-1 sm:flex",
        visibleCount === null && "overflow-x-clip",
        className,
      )}
      ref={containerRef}
    >
      <NavigationMenu>
        <NavigationMenuList>
          {visibleItems.map(item => (
            <HeaderNavEntry item={item} key={item.id} />
          ))}
          {overflowItems.length > 0 ? (
            <HeaderNavMoreEntry items={overflowItems} label={moreLabel} />
          ) : null}
        </NavigationMenuList>
      </NavigationMenu>

      <div
        aria-hidden
        className="pointer-events-none invisible absolute inset-0 overflow-hidden"
        inert
      >
        <div className="flex w-max gap-1" ref={measureRef}>
          {navigation.map(item => (
            <span data-nav-measure="item" key={item.id}>
              <MeasuredNavLabel
                hasDropdown={Boolean(item.items?.length)}
                icon={item.icon}
                label={item.label}
              />
            </span>
          ))}
          <span data-nav-measure="more">
            <MeasuredNavLabel hasDropdown label={moreLabel} />
          </span>
        </div>
      </div>
    </div>
  );
};

const NAV_SKELETON_WIDTHS = ["w-20", "w-24", "w-16"] as const;

export const HeaderNavSkeleton = ({
  className,
  label,
}: {
  className?: string;
  label: string;
}) => (
  <div
    aria-busy="true"
    className={cn(
      "hidden min-w-0 flex-1 items-center gap-1 sm:flex",
      className,
    )}
    role="status"
  >
    <span className="sr-only">{label}</span>
    {NAV_SKELETON_WIDTHS.map(width => (
      <Skeleton className={cn("h-9", width)} key={width} />
    ))}
  </div>
);
