import { createNavigation, QueryParams } from 'next-intl/navigation';
import { getLocale } from 'next-intl/server';
import { RedirectType } from 'next/navigation';

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
