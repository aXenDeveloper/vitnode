import { TranslationsProvider } from '@/components/translations-provider';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { SidebarInset } from '@/components/ui/sidebar-server';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { SidebarAdmin } from './sidebar/sidebar';

export const generateMetadataAdminLayout = async (): Promise<Metadata> => {
  const t = await getTranslations('admin.global');

  return {
    title: {
      default: t('title_short'),
      template: `%s - ${t('title_short')}`,
    },
  };
};

export const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <TranslationsProvider namespaces="admin.global">
      <SidebarProvider>
        <SidebarAdmin />
        <SidebarInset>
          <header className="flex h-12 shrink-0 items-center gap-2">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
            </div>
          </header>

          <div className="container flex-1 p-4">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TranslationsProvider>
  );
};
