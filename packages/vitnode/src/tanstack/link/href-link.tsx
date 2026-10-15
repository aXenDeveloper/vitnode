import {
  type ActiveOptions,
  Link,
  type LinkProps,
  type SearchParser,
  useRouter,
} from "@tanstack/react-router";
import { useCallback } from "react";

import { isExternalHref } from "@/views/admin/layouts/normalize-url";

const RELATIVE_BASE = "https://vitnode.invalid";

const hrefDestination = (href: string, parseSearch: SearchParser) => {
  const url = new URL(href, RELATIVE_BASE);

  return {
    hash: url.hash.slice(1) || undefined,
    search: parseSearch(url.search),
    to: url.pathname,
  };
};

export interface HrefLinkProps extends Omit<React.ComponentProps<"a">, "href"> {
  activeOptions?: ActiveOptions;
  href: string;
  preload?: LinkProps["preload"];
  preloadDelay?: number;
}

const EXACT_URL: ActiveOptions = { exact: true, includeHash: true };

const InternalHrefLink = ({
  activeOptions = EXACT_URL,
  href,
  ...props
}: HrefLinkProps) => {
  const { parseSearch } = useRouter().options;

  return (
    <Link
      {...props}
      {...hrefDestination(href, parseSearch)}
      activeOptions={activeOptions}
    />
  );
};

export const HrefLink = ({
  activeOptions,
  preload,
  preloadDelay,
  ...props
}: HrefLinkProps) =>
  isExternalHref(props.href) ? (
    <a {...props} />
  ) : (
    <InternalHrefLink
      {...props}
      activeOptions={activeOptions}
      preload={preload}
      preloadDelay={preloadDelay}
    />
  );

export const useHrefNavigate = () => {
  const router = useRouter();

  return useCallback(
    async (href: string, { replace }: { replace?: boolean } = {}) => {
      if (isExternalHref(href)) {
        if (replace) window.location.replace(href);
        else window.location.assign(href);

        return;
      }

      await router.navigate({
        ...hrefDestination(href, router.options.parseSearch),
        replace,
      });
    },
    [router],
  );
};
