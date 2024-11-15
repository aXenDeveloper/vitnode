'use client';

import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Sidebar } from '@/components/ui/sidebar';
import { SidebarContent, SidebarHeader } from '@/components/ui/sidebar-server';
import { TooltipWrapper } from '@/components/ui/tooltip';
import { MonitorIcon, SmartphoneIcon, TabletIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ThemeEditorViewEnum } from './content';
import { useThemeEditor } from './hooks/use-theme-editor';
import { LogosSidebarThemeEditorStyleAdmin } from './tabs/logos';
import { MobileLogosSidebarThemeEditorStyleAdmin } from './tabs/mobile-logos';

export const SidebarThemeEditorStyleAdmin = ({
  setActiveMode,
  activeMode,
}: {
  activeMode: ThemeEditorViewEnum;
  setActiveMode: React.Dispatch<React.SetStateAction<ThemeEditorViewEnum>>;
}) => {
  const t = useTranslations('admin.core.styles.theme-editor');
  const { form, onSubmit } = useThemeEditor();

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
      <SidebarHeader className="flex-row">
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
      </SidebarHeader>

      <SidebarContent>
        <Form {...form}>
          <form
            className="relative flex h-full flex-col"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <div className="space-y-4 pt-6">
              <LogosSidebarThemeEditorStyleAdmin />
              <MobileLogosSidebarThemeEditorStyleAdmin />
            </div>

            <div className="bg-card sticky bottom-0 mt-auto p-4 pb-6">
              <Button
                className="w-full"
                disabled={!form.formState.isValid}
                loading={form.formState.isSubmitting}
                type="submit"
              >
                {t('save')}
              </Button>
            </div>
          </form>
        </Form>
      </SidebarContent>
    </Sidebar>
  );
};
