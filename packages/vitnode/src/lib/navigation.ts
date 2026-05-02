import type { QueryParams } from "next-intl/navigation";

// Some Next versions export RedirectType as a value; declare a local type to avoid
// the "refers to a value, but is being used as a type" TS error.
type RedirectType = "push" | "replace";

import { createNavigation } from "next-intl/navigation";
import { getLocale } from "next-intl/server";

const {
  Link,
  redirect: redirectFromImport,
  usePathname,
  useRouter,
  getPathname,
} = createNavigation();

const redirect = async (
  href:
    | string
    | {
        pathname: string;
        query?: QueryParams;
      },
  type?: RedirectType,
) => {
  const locale = await getLocale();

  redirectFromImport({ href, locale }, type);
};

export { getPathname, Link, redirect, usePathname, useRouter };
