'use client';

import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/ui/sidebar';
import { TooltipWrapper } from '@/components/ui/tooltip';
import { MonitorIcon, SmartphoneIcon, TabletIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ThemeEditorViewEnum } from './content';

export const SidebarThemeEditorStyleAdmin = ({
  setActiveMode,
  activeMode,
}: {
  activeMode: ThemeEditorViewEnum;
  setActiveMode: React.Dispatch<React.SetStateAction<ThemeEditorViewEnum>>;
}) => {
  const t = useTranslations('admin.core.styles.theme-editor');

  const ButtonWithTooltip = ({
    active,
    ariaLabel,
    children,
    onClick,
  }: {
    active?: boolean;
    ariaLabel: string;
    children: React.ReactNode;
    onClick: () => void;
  }) => {
    return (
      <TooltipWrapper content={ariaLabel}>
        <Button
          ariaLabel={ariaLabel}
          className="relative size-9 shrink-0"
          onClick={onClick}
          size="icon"
          variant={active ? 'default' : 'ghost'}
        >
          {children}
        </Button>
      </TooltipWrapper>
    );
  };

  return (
    <Sidebar className="h-auto" side="right">
      <div className="flex gap-1 p-2">
        <ButtonWithTooltip
          active={activeMode === ThemeEditorViewEnum.Desktop}
          ariaLabel={t(ThemeEditorViewEnum.Desktop)}
          onClick={() => {
            setActiveMode(ThemeEditorViewEnum.Desktop);
          }}
        >
          <MonitorIcon />
        </ButtonWithTooltip>

        <ButtonWithTooltip
          active={activeMode === ThemeEditorViewEnum.Tablet}
          ariaLabel={t(ThemeEditorViewEnum.Tablet)}
          onClick={() => {
            setActiveMode(ThemeEditorViewEnum.Tablet);
          }}
        >
          <TabletIcon />
        </ButtonWithTooltip>

        <ButtonWithTooltip
          active={activeMode === ThemeEditorViewEnum.Mobile}
          ariaLabel={t(ThemeEditorViewEnum.Mobile)}
          onClick={() => {
            setActiveMode(ThemeEditorViewEnum.Mobile);
          }}
        >
          <SmartphoneIcon />
        </ButtonWithTooltip>
      </div>
    </Sidebar>
  );
};
