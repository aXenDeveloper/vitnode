import { useSuspenseQuery } from "@tanstack/react-query";
import { PanelBottomIcon, PanelTopIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { NavigationLocation } from "@/lib/navigation";
import type { AdminNavigationItem } from "@/views/admin/views/core/navigation/navigation-query";

import { AdminStaffPermissionGate } from "@/components/staff-permission/provider";
import { PageTitle } from "@/components/ui/page-title";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsPanels,
  TabsTrigger,
} from "@/components/ui/tabs";
import { NAVIGATION_LOCATIONS } from "@/lib/navigation";
import { CreateNavigationAction } from "@/views/admin/views/core/navigation/navigation-create-dialog";
import { NavigationAdminListContent } from "@/views/admin/views/core/navigation/navigation-list-content";
import { ADMIN_NAVIGATION_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";

import type { AdminNavigationRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import {
  adminNavigationPresetsQuery,
  adminNavigationQuery,
  useAdminNavigationMutations,
} from "./query";
import { ADMIN_NAVIGATION_NAMESPACES } from "./route";

const LOCATION_TABS = {
  bottom_bar: {
    descKey: "bottomBarDesc",
    Icon: PanelBottomIcon,
    labelKey: "bottomBar",
  },
  header: { descKey: "headerDesc", Icon: PanelTopIcon, labelKey: "header" },
} as const;

const isNavigationLocation = (value: unknown): value is NavigationLocation =>
  NAVIGATION_LOCATIONS.some(location => location === value);

const NavigationLocationTabs = ({
  location,
  onLocationChange,
  panel,
}: {
  location: NavigationLocation;
  onLocationChange: (location: NavigationLocation) => void;
  panel: (location: NavigationLocation) => React.ReactNode;
}) => {
  const t = useTranslations("admin.navigation.tabs");

  return (
    <Tabs
      className="gap-4"
      onValueChange={value => {
        if (isNavigationLocation(value)) onLocationChange(value);
      }}
      value={location}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <TabsList aria-label={t("label")} className="w-full sm:w-fit">
          {NAVIGATION_LOCATIONS.map(value => {
            const { Icon, labelKey } = LOCATION_TABS[value];

            return (
              <TabsTrigger className="sm:px-3" key={value} value={value}>
                <Icon aria-hidden />
                {t(labelKey)}
              </TabsTrigger>
            );
          })}
        </TabsList>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t(LOCATION_TABS[location].descKey)}
        </p>
      </div>

      <TabsPanels>
        {NAVIGATION_LOCATIONS.map(value => (
          <TabsContent key={value} value={value}>
            {panel(value)}
          </TabsContent>
        ))}
      </TabsPanels>
    </Tabs>
  );
};

export const AdminNavigationRouteContent = ({
  adminUserId,
  description,
  namespaces,
  title,
}: AdminNavigationRouteData) => {
  const { data } = useSuspenseQuery(adminNavigationQuery({ adminUserId }));
  const { data: presetsData } = useSuspenseQuery(
    adminNavigationPresetsQuery({ adminUserId }),
  );
  const { onDelete, onReorder, onSave } = useAdminNavigationMutations();
  const [location, setLocation] = React.useState<NavigationLocation>("header");

  const messageNamespaces = React.useMemo(
    () => [...ADMIN_NAVIGATION_NAMESPACES, ...namespaces],
    [namespaces],
  );
  const itemsByLocation = React.useMemo(
    () =>
      Object.fromEntries(
        NAVIGATION_LOCATIONS.map(value => [
          value,
          data.items.filter(item => item.location === value),
        ]),
      ) as Record<NavigationLocation, AdminNavigationItem[]>,
    [data.items],
  );

  return (
    <RouteMessages namespaces={messageNamespaces}>
      <div className="flex flex-col gap-4 p-4">
        <PageTitle desc={description} h1={title}>
          <AdminStaffPermissionGate {...ADMIN_NAVIGATION_PERMISSIONS.create}>
            <CreateNavigationAction
              items={itemsByLocation[location]}
              location={location}
              onSave={onSave}
              presets={presetsData.presets}
            />
          </AdminStaffPermissionGate>
        </PageTitle>

        <NavigationLocationTabs
          location={location}
          onLocationChange={setLocation}
          panel={value => (
            <NavigationAdminListContent
              items={itemsByLocation[value]}
              location={value}
              onDelete={onDelete}
              onReorder={async body =>
                await onReorder({ ...body, location: value })
              }
              onSave={onSave}
              presets={presetsData.presets}
            />
          )}
        />
      </div>
    </RouteMessages>
  );
};
