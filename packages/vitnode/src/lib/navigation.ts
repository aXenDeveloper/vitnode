import type { QueryParams } from "next-intl/navigation";
import type { RedirectType } from "next/navigation";

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
