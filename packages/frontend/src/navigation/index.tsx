import { createNavigation, QueryParams } from 'next-intl/navigation';
import { getLocale } from 'next-intl/server';
import { RedirectType } from 'next/navigation';
import React from 'react';

import { usePathname, useRouter } from './router';
const { redirect: redirectFromImport, Link: LinkFromImport } =
  createNavigation();

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

const Link = (props: React.ComponentProps<typeof LinkFromImport>) => {
  return <LinkFromImport {...props} />;
};

export { Link, redirect, usePathname, useRouter };
