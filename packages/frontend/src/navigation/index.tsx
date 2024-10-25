import { RedirectType } from 'next/navigation';
import { createNavigation } from 'next-intl/navigation';
import { getLocale } from 'next-intl/server';
import { QueryParams } from 'node_modules/next-intl/dist/types/src/navigation/shared/utils';
import React from 'react';

import { usePathname, useRouter } from './router';
const { redirect: redirectFromImport, Link: LinkFromImport } =
  createNavigation();

const redirect = async (
  href:
    | {
        pathname: string;
        query?: QueryParams;
      }
    | string,
  type?: RedirectType,
) => {
  const locale = await getLocale();

  redirectFromImport({ href, locale }, type);
};

const Link = (props: React.ComponentProps<typeof LinkFromImport>) => {
  return <LinkFromImport {...props} />;
};

export { Link, redirect, usePathname, useRouter };
