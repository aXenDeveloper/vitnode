import { getSessionAdminData } from '@/api/get-session-admin-data';
import { TranslationsProvider } from '@/components/translations-provider';
import { Separator } from '@/components/ui/separator';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { SidebarInset } from '@/components/ui/sidebar-server';
import { CONFIG } from '@/helpers/config-with-env';
import { redirect } from '@/navigation';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { SidebarAdmin } from './sidebar/sidebar';
import { WrapperAdminLayout } from './wrapper';

export interface TextAndIconsAsideAdmin {
  icon: null | React.ReactNode;
  id: string;
  parent_text?: string;
  plugin: string;
  plugin_code: string;
  text: string;
}

export const generateMetadataAdminLayout = async (): Promise<Metadata> => {
  const t = await getTranslations('admin.global');

  return {
    title: {
      default: t('title_short'),
      template: `%s - ${t('title_short')}`,
    },
  };
};

export const AdminLayout = async ({
  children,
}: {
  children: React.ReactNode;
}) => {
  try {
    const data = await getSessionAdminData();

    return (
      <TranslationsProvider namespaces="admin.global">
        <WrapperAdminLayout data={data}>
          {CONFIG.node_development && (
            <div
              className="absolute left-0 top-0 z-50 h-1 w-full"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(-55deg,#000, #000 20px, #ffb103 20px, #feb100 40px)',
              }}
            />
          )}
          <SidebarProvider>
            <SidebarAdmin />
            <SidebarInset>
              <header className="flex h-16 shrink-0 items-center gap-2">
                <div className="flex items-center gap-2 px-4">
                  <SidebarTrigger className="-ml-1" />
                  <Separator className="mr-2 h-4" orientation="vertical" />
                  <div>header</div>
                </div>
              </header>

              <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                {children}
              </div>
            </SidebarInset>
          </SidebarProvider>
        </WrapperAdminLayout>
      </TranslationsProvider>
    );
  } catch (_) {
    await redirect('/admin');
  }
};
