'use client';

import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import React from 'react';

import { Button } from '../ui/button';
import { TooltipWrapper } from '../ui/tooltip';

export const ThemeSwitcher = () => {
  const t = useTranslations('core.global');
  const { setTheme, resolvedTheme } = useTheme();

  return (
    <TooltipWrapper content={t('dark_light_switcher')}>
      <Button
        ariaLabel={t('dark_light_switcher')}
        className="relative"
        onClick={() => {
          const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
          setTheme(nextTheme);
        }}
        size="icon"
        variant="ghost"
      >
        <Sun className="size-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute size-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </Button>
    </TooltipWrapper>
  );
};
