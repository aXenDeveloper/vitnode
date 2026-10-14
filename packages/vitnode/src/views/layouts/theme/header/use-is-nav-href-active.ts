import { useMatchRoute } from "@tanstack/react-router";

import { isExternalNavigationHref } from "@/lib/navigation";

export const useIsNavHrefActive = () => {
  const matchRoute = useMatchRoute();

  return (href: string): boolean =>
    !isExternalNavigationHref(href) &&
    Boolean(matchRoute({ fuzzy: href !== "/", to: href }));
};
