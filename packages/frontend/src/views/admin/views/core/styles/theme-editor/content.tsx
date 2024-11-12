'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { SidebarInset } from '@/components/ui/sidebar-server';
import { cn } from '@/helpers/classnames';
import { CONFIG } from '@/helpers/config-with-env';
import React from 'react';

import { SidebarThemeEditorStyleAdmin } from './sidebar';

export enum ThemeEditorViewEnum {
  Desktop = 'desktop',
  Mobile = 'mobile',
  Tablet = 'tablet',
}

export const ContentThemeEditorStyleAdmin = () => {
  const [activeMode, setActiveMode] = React.useState<ThemeEditorViewEnum>(
    ThemeEditorViewEnum.Desktop,
  );

  return (
    <>
      <div className="fixed right-0 top-0 z-20 flex h-12 items-center gap-2 px-4">
        <SidebarTrigger />
      </div>
      <SidebarInset className="flex min-h-full items-center justify-center">
        <iframe
          className={cn('bg-card rounded-lg border shadow-md transition-all', {
            'h-full w-full': activeMode === ThemeEditorViewEnum.Desktop,
            'h-5/6 w-[768px] rounded-md border':
              activeMode === ThemeEditorViewEnum.Tablet,
            'h-5/6 w-[375px] rounded-md border':
              activeMode === ThemeEditorViewEnum.Mobile,
          })}
          src={CONFIG.frontend_url}
          title={CONFIG.frontend_url}
        />
      </SidebarInset>

      <SidebarThemeEditorStyleAdmin
        activeMode={activeMode}
        setActiveMode={setActiveMode}
      />
    </>
  );
};
