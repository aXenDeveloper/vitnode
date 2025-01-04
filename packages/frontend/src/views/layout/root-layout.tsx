import { getMiddlewareData } from '@/api/get-middleware-data';
import { TranslationsProvider } from '@/components/translations-provider';
import { Metadata } from 'next';
import React from 'react';

import { CONFIG } from '../../helpers/config-with-env';
import { InternalErrorView } from '../global';
import { RootProviders } from './providers';
import { WrapperRootLayout } from './wrapper';

export const dynamic = 'force-dynamic';

interface Props {
  children: React.ReactNode;
  className?: string;
  params: Promise<{ locale: string }>;
}

export const generateMetadataRootLayout = async ({
  params,
}: Pick<Props, 'params'>): Promise<Metadata> => {
  const { locale } = await params;
  const metadata: Metadata = {
    metadataBase: new URL(CONFIG.backend_client_public_url),
    manifest: `${CONFIG.backend_client_public_url}/assets/${locale}/manifest.webmanifest`,
    icons: {
      icon: '/favicon.ico',
    },
  };

  try {
    const { site_name, site_short_name, languages } = await getMiddlewareData();
    const language = languages.find(lang => lang.code === locale);

    return {
      ...metadata,
      title: {
        default: site_name,
        template: `%s - ${site_short_name}`,
      },
      openGraph: {
        siteName: site_name,
        type: 'website',
        locale: language ? language.code : 'en_US',
      },
    };
  } catch (_) {
    return {
      ...metadata,
      title: 'Error 500!',
      robots: 'noindex, nofollow',
    };
  }
};

export const RootLayout = async ({ children, params, className }: Props) => {
  const { locale } = await params;
  try {
    const middlewareData = await getMiddlewareData();

    return (
      <WrapperRootLayout className={className} locale={locale}>
        <RootProviders middlewareData={middlewareData}>
          <TranslationsProvider namespaces={[]}>
            {children}
          </TranslationsProvider>
        </RootProviders>
      </WrapperRootLayout>
    );
  } catch (_) {
    return (
      <WrapperRootLayout locale={locale}>
        <RootProviders>
          <TranslationsProvider namespaces={[]}>
            <InternalErrorView />
          </TranslationsProvider>
        </RootProviders>
      </WrapperRootLayout>
    );
  }
};
