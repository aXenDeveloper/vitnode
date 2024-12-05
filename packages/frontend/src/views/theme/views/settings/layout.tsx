import { getSessionData } from '@/api/get-session-data';
import { TranslationsProvider } from '@/components/translations-provider';
import { notFound } from 'next/navigation';
import React from 'react';

import { NavSettings } from './nav/nav-settings';

export const LayoutSettingsView = async ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const session = await getSessionData();
  if (!session.user) {
    notFound();
  }

  return (
    <TranslationsProvider namespaces="core.settings">
      <div className="container my-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8 [&>div]:grow">
          <NavSettings />
          {children}
        </div>
      </div>
    </TranslationsProvider>
  );
};
