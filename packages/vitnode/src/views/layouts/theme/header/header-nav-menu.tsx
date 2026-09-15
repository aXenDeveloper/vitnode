import { Link, useMatchRoute } from "@tanstack/react-router";
import { cn } from "cn";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

import type { HeaderNavItem } from "./header-nav";

const HeaderNavEntry = ({ item }: { item: HeaderNavItem }) => {
  const matchRoute = useMatchRoute();

  if (!item.items?.length) {
    return (
      <NavigationMenuItem>
        <NavigationMenuLink
          active={Boolean(matchRoute({ to: item.href }))}
          className={cn(
            navigationMenuTriggerStyle(),
            "text-muted-foreground hover:text-foreground data-active:text-foreground",
          )}
          render={<Link to={item.href} />}
        >
          {item.label}
        </NavigationMenuLink>
      </NavigationMenuItem>
    );
  }

  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger className="text-muted-foreground hover:text-foreground data-popup-open:text-foreground">
        {item.label}
      </NavigationMenuTrigger>

      <NavigationMenuContent>
        <ul className="flex w-64 flex-col gap-1">
          {item.items.map(child => (
            <li key={child.href}>
              <NavigationMenuLink
                active={Boolean(matchRoute({ to: child.href }))}
                className="flex-col items-start gap-0.5"
                render={<Link to={child.href} />}
              >
                <span className="font-medium">{child.label}</span>
                {child.description ? (
                  <span className="text-muted-foreground text-xs leading-relaxed text-pretty">
                    {child.description}
                  </span>
                ) : null}
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
        <HeaderNavEntry item={item} key={item.href} />
      ))}
    </NavigationMenuList>
  </NavigationMenu>
);
