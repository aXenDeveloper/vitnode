import { TranslationsProvider } from '@/components/translations-provider';
import { SidebarProvider } from '@/components/ui/sidebar';
import React from 'react';

import { ContentThemeEditorStyleAdmin } from './content';
import { WrapperThemeEditorAdmin } from './wrapper';

export const ThemeEditorStyleAdminView = () => {
  return (
    <TranslationsProvider namespaces="admin.core.styles.theme-editor">
      <WrapperThemeEditorAdmin>
        <SidebarProvider className="min-h-full">
          <ContentThemeEditorStyleAdmin />
        </SidebarProvider>
      </WrapperThemeEditorAdmin>
    </TranslationsProvider>
  );
};
