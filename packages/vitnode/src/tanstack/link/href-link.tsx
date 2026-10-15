import {
  type ActiveOptions,
  Link,
  type LinkProps,
  type SearchParser,
  useRouter,
} from "@tanstack/react-router";
import { useCallback } from "react";

import { isExternalHref } from "@/views/admin/layouts/normalize-url";

/**
 * A base for `URL` to resolve an internal href against. Never requested; only
 * `pathname`, `search` and `hash` are read back off it.
 */
const RELATIVE_BASE = "https://vitnode.invalid";

/**
 * An internal href split into what a router navigation takes. The query goes
 * through the router's own `parseSearch`, so `?forum=123` arrives as the number
 * a full page load would give the route's validator, and is written back as
 * `?forum=123` - not JSON-quoted, as a `"123"` string would be.
 */
const hrefDestination = (href: string, parseSearch: SearchParser) => {
  const url = new URL(href, RELATIVE_BASE);

  return {
    hash: url.hash.slice(1) || undefined,
    search: parseSearch(url.search),
    to: url.pathname,
  };
};

export interface HrefLinkProps extends Omit<React.ComponentProps<"a">, "href"> {
  /** When the link counts as the current page. Defaults to this exact URL, query and hash included. */
  activeOptions?: ActiveOptions;
  /**
   * An internal path in the route tree's spelling - no locale prefix - with
   * any query and hash (`/forum/news?cursor=abc#top`), or an absolute URL.
   */
  href: string;
  preload?: LinkProps["preload"];
  preloadDelay?: number;
}

/**
 * `aria-current="page"` only on a link to exactly this URL. The router's own
 * default matches by prefix, which would mark "Back to forums" as the page
 * you are on from anywhere under `/forum`.
 */
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
 * A link built from an href string, for code that cannot name a typed route -
 * a plugin page, or an href that arrives as data.
 *
 * An internal href becomes a router link: it client-navigates, preloads on
 * intent, and the locale rewrite adds the language prefix. An external one is
 * a plain `<a>`.
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

/** {@link HrefLink}'s counterpart for a navigation nobody clicked, such as after a form is saved. */
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
