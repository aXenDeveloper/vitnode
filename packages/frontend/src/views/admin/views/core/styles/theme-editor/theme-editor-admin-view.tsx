import { TranslationsProvider } from '@/components/translations-provider';
import { SidebarProvider } from '@/components/ui/sidebar';
import React from 'react';

import { ContentThemeEditorStyleAdmin } from './content';

export const ThemeEditorStyleAdminView = () => {
  return (
    <TranslationsProvider namespaces="admin.core.styles.theme-editor">
      <SidebarProvider className="min-h-full">
        <ContentThemeEditorStyleAdmin />
      </SidebarProvider>
    </TranslationsProvider>
  );
};
