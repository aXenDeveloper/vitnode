import {
  BoxIcon,
  ClockIcon,
  DatabaseZapIcon,
  LayoutGridIcon,
  ListTodoIcon,
  MenuIcon,
  PlugIcon,
  PuzzleIcon,
  ScrollTextIcon,
  SearchIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { DebugTab } from "@/tanstack/admin/debug/route-search";

import {
  SideNav,
  SideNavGroup,
  SideNavLink,
  SideNavList,
} from "@/components/side-nav";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { debugTabPath } from "@/tanstack/admin/debug/route-search";
import {
  DEBUG_DIAGNOSTIC_TABS,
  DEBUG_SYSTEM_TABS,
} from "@/tanstack/admin/debug/tabs";

import type { DebugHealth } from "../health/health";

import { isProblem } from "../health/health";
import { TONE_TEXT } from "../tone";

export const DEBUG_TAB_ICONS: Record<
  DebugTab,
  React.ComponentType<{ className?: string }>
> = {
  ai: SparklesIcon,
  cache: DatabaseZapIcon,
  cron: ClockIcon,
  logs: ScrollTextIcon,
  overview: LayoutGridIcon,
  plugins: PuzzleIcon,
  queue: ListTodoIcon,
  search: SearchIcon,
  services: PlugIcon,
  vitnode: BoxIcon,
};

const NavItem = ({
  active,
  count,
  countTone,
  onNavigate,
  tab,
}: {
  active: boolean;
  count?: number;
  countTone?: "critical" | "warn";
  onNavigate?: () => void;
  tab: DebugTab;
}) => {
  const t = useTranslations("admin.debug.nav");

  return (
    <SideNavLink
      count={count}
      countClassName={countTone && TONE_TEXT[countTone]}
      icon={DEBUG_TAB_ICONS[tab]}
      isActive={active}
      label={t(tab)}
      onNavigate={onNavigate}
      to={debugTabPath(tab)}
    />
  );
};

const NavGroups = ({
  active,
  health,
  onNavigate,
  tabs,
}: {
  active: DebugTab;
  health: DebugHealth;
  onNavigate?: () => void;
  tabs: DebugTab[];
}) => {
  const t = useTranslations("admin.debug.nav");
  const hasCritical = health.issues.some(issue => issue.tone === "critical");
  const groups = [
    {
      id: "systems",
      tabs: DEBUG_SYSTEM_TABS.filter(tab => tabs.includes(tab)),
    },
    {
      id: "diagnostics",
      tabs: DEBUG_DIAGNOSTIC_TABS.filter(tab => tabs.includes(tab)),
    },
  ] as const;

  return (
    <>
      <SideNavGroup>
        <SideNavList>
          <NavItem
            active={active === "overview"}
            count={health.issues.length}
            countTone={hasCritical ? "critical" : "warn"}
            onNavigate={onNavigate}
            tab="overview"
          />
        </SideNavList>
      </SideNavGroup>
      {groups
        .filter(group => group.tabs.length > 0)
        .map(group => (
          <SideNavGroup key={group.id} title={t(group.id)}>
            <SideNavList>
              {group.tabs.map(tab => {
                const area = health.areas.find(entry => entry.id === tab);
                const issues =
                  area?.checks.filter(check => isProblem(check.tone)) ?? [];

                return (
                  <NavItem
                    active={active === tab}
                    count={issues.length}
                    countTone={area?.tone === "critical" ? "critical" : "warn"}
                    key={tab}
                    onNavigate={onNavigate}
                    tab={tab}
                  />
                );
              })}
            </SideNavList>
          </SideNavGroup>
        ))}
    </>
  );
};

export const DebugNav = ({
  active,
  health,
  tabs,
}: {
  active: DebugTab;
  health: DebugHealth;
  tabs: DebugTab[];
}) => {
  const t = useTranslations("admin.debug");
  const tGlobal = useTranslations("core.global");
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <div className="md:hidden">
        <Drawer direction="left" onOpenChange={setIsOpen} open={isOpen}>
          <DrawerTrigger asChild>
            <Button className="w-full justify-start" variant="outline">
              <MenuIcon aria-hidden />
              <span className="text-muted-foreground">{t("nav.menu")}</span>
              <span className="truncate">{t(`nav.${active}`)}</span>
            </Button>
          </DrawerTrigger>
          <DrawerContent aria-describedby={undefined}>
            <div className="flex items-center justify-between gap-2 px-4 pt-[max(env(safe-area-inset-top),1rem)]">
              <DrawerTitle className="text-base font-semibold">
                {t("title")}
              </DrawerTitle>
              <DrawerClose asChild>
                <Button
                  aria-label={tGlobal("close")}
                  size="icon"
                  variant="ghost"
                >
                  <XIcon />
                </Button>
              </DrawerClose>
            </div>
            <nav
              aria-label={t("nav.label")}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pt-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
            >
              <NavGroups
                active={active}
                health={health}
                onNavigate={() => {
                  setIsOpen(false);
                }}
                tabs={tabs}
              />
            </nav>
          </DrawerContent>
        </Drawer>
      </div>

      <SideNav
        aria-label={t("nav.label")}
        className="self-start max-md:hidden md:sticky md:top-4"
      >
        <NavGroups active={active} health={health} tabs={tabs} />
      </SideNav>
    </>
  );
};
