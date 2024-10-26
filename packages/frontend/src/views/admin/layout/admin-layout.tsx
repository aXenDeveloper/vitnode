import { TranslationsProvider } from '@/components/translations-provider';
import { Separator } from '@/components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { SidebarAdmin } from './sidebar/sidebar';

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

export const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <TranslationsProvider namespaces="admin.global">
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

          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TranslationsProvider>
  );
};
