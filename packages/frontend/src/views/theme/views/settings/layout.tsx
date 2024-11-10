import { getSessionData } from '@/api/get-session-data';
import { TranslationsProvider } from '@/components/translations-provider';
import { Card } from '@/components/ui/card';
import { HeaderContent } from '@/components/ui/header-content';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import React from 'react';

import { NavSettings } from './nav/nav-settings';

export const LayoutSettingsView = async ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [t, session] = await Promise.all([
    getTranslations('core'),
    getSessionData(),
  ]);

  if (!session.user) {
    notFound();
  }

  return (
    <TranslationsProvider namespaces="core.settings">
      <div className="container my-4">
        <HeaderContent
          className="mb-5"
          desc={t('settings.desc')}
          h2={t('settings.title')}
        />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
          <NavSettings />
          <Card className="grow">{children}</Card>
        </div>
      </div>
    </TranslationsProvider>
  );
};
