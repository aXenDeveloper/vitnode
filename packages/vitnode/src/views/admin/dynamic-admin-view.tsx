import { setRequestLocale } from 'next-intl/server';
import { Metadata } from 'next/dist/types';
import { notFound } from 'next/navigation';

import { VitNodeConfig } from '../../vitnode.config';
import { DashboardAdminView } from './views/core/dashboard/dashboard-admin-view';
import { TestView } from './views/core/test';
import { UsersAdminView } from './views/core/users/users-admin-view';

export interface DynamicAdminViewProps {
  params: Promise<{
    locale: string;
    rest: string[];
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const generateMetadataDynamicAdminView = async ({
  params,
}: DynamicAdminViewProps): Promise<Metadata> => {
  const { rest } = await params;
  const path = rest.join('/');

  const views: Record<string, Promise<Metadata>> = {};

  return await views[path];
};

export const DynamicAdminView = async (
  props: DynamicAdminViewProps & {
    config: VitNodeConfig;
  },
) => {
  const { rest, locale } = await props.params;
  setRequestLocale(locale);
  const path = rest.join('/');

  const views = {
    core: <DashboardAdminView />,
    'core/users': <UsersAdminView {...props} />,
    'core/test': <TestView />,
  };

  const view = views[path];

  if (view) {
    return view;
  }

  notFound();
};

export const dynamicAdminViewGenerateStaticParams = (locales: string[]) => {
  return locales.map(locale => ({
    locale,
    rest: ['core', 'core/users', 'core/test'],
  }));
};
