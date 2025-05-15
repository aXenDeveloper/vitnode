import type { Metadata } from 'next/dist/types';

import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import type { VitNodeConfig } from '../vitnode.config';

import { I18nProvider } from '../components/i18n-provider';
import {
  generateMetadataSignInView,
  SignInView,
} from './auth/sign-in/sign-in-view';
import {
  generateMetadataSignUpView,
  SignUpView,
} from './auth/sign-up/sign-up-view';
import { CallbackSSOView } from './auth/sso/callback/callback-sso-view';

export interface DynamicViewProps {
  params: Promise<{
    locale: string;
    rest: string[];
  }>;
  searchParams: Promise<Record<string, string>>;
}

export const generateMetadataDynamicView = async ({
  params,
}: DynamicViewProps): Promise<Metadata> => {
  const { rest, locale } = await params;
  const path = rest.join('/');

  const views: Record<string, Promise<Metadata>> = {
    register: generateMetadataSignUpView(locale),
    login: generateMetadataSignInView(locale),
  };

  return await views[path];
};

export const DynamicView = async ({
  params,
  searchParams,
  config,
}: DynamicViewProps & {
  config: VitNodeConfig;
}) => {
  const { rest, locale } = await params;
  setRequestLocale(locale);
  const path = rest.join('/');

  if (rest[0] === 'login' && rest[1] === 'sso' && rest[2] && !rest[3]) {
    const providerId = rest[2];

    return (
      <CallbackSSOView providerId={providerId} searchParams={searchParams} />
    );
  }

  const views = {
    register: (
      <I18nProvider namespaces={'core.auth.sign_up'}>
        <SignUpView />
      </I18nProvider>
    ),
    login: (
      <I18nProvider namespaces={'core.auth.sign_in'}>
        <SignInView />
      </I18nProvider>
    ),
  };

  const view = views[path];

  if (view) {
    return view;
  }

  // Try to render a plugin view if available
  const plugin = config.plugins.find(
    p => p.name === rest[0] && typeof p.pages === 'function',
  );

  if (plugin?.pages) {
    return plugin.pages();
  }

  notFound();
};

export function dynamicViewGenerateStaticParams<
  AppLocales extends string[] = string[],
>(locales: AppLocales) {
  return locales.map(locale => ({ locale, rest: ['register', 'login'] }));
}
