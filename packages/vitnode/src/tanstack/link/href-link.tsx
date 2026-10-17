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
  /**
   * When the link counts as active (`data-status="active"`). Defaults to an
   * exact match of path and hash. Ignored for external links.
   */
  activeOptions?: ActiveOptions;
  /**
   * A full URL string - path, search and hash - such as a stored or
   * API-provided link. An absolute URL (`https:`, `mailto:`, `//...`) renders
   * a plain `<a>`.
   */
  href: string;
  /** TanStack Router preloading for internal links. */
  preload?: LinkProps["preload"];
  /** Milliseconds before an intent preload starts, for internal links. */
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

/**
 * A link for an `href` string you did not build from a route - navigation
 * entries, content URLs, links returned by the API. Internal hrefs become a
 * TanStack Router `<Link>` (client-side navigation, preloading, active state)
 * with the search string parsed by the router; external ones render a plain
 * `<a>`.
 *
 * Prefer TanStack Router's own `<Link to>` when the target is a typed route.
 *
 * @example
 * ```tsx
 * import { HrefLink } from "@vitnode/core/tanstack/link";
 *
 * <HrefLink href={`/blog/${post.slug}#comments`}>{post.title}</HrefLink>;
 * ```
 */
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

/**
 * Imperative counterpart of {@link HrefLink}: returns `navigate(href, { replace })`,
 * which routes an internal href through the router and sends an external one
 * through `window.location`. Browser-only - call the returned function from
 * event handlers or effects.
 */
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
