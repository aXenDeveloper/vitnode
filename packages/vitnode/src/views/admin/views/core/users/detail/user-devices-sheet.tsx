import {
  ChevronsDownIcon,
  GlobeIcon,
  ListFilterIcon,
  SearchIcon,
  SearchXIcon,
  ShieldIcon,
  XIcon,
} from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import type { AdminUserDevice } from "./user-account-query";

import { DeviceRow, SignOutAllButton, useDeviceName } from "./user-device-row";

const PAGE_SIZE = 25;

type SessionKind = AdminUserDevice["sessionKinds"][number];

const SESSION_KINDS: {
  icon: React.ElementType<{ "aria-hidden"?: boolean }>;
  kind: SessionKind;
}[] = [
  { icon: GlobeIcon, kind: "user" },
  { icon: ShieldIcon, kind: "admin" },
];

const matchesKinds = (device: AdminUserDevice, kinds: SessionKind[]) =>
  kinds.length === 0 || kinds.some(kind => device.sessionKinds.includes(kind));

export const UserDevicesSheetContent = ({
  canEdit,
  devices,
  onRevoke,
  onSignOutAll,
  userName,
}: {
  canEdit: boolean;
  devices: AdminUserDevice[];
  onRevoke: (device: AdminUserDevice) => Promise<void>;
  onSignOutAll: () => Promise<boolean>;
  userName: string;
}) => {
  const t = useTranslations("admin.user.show.devices");
  const deviceName = useDeviceName();
  const [search, setSearch] = React.useState("");
  const [kinds, setKinds] = React.useState<SessionKind[]>([]);
  const [visible, setVisible] = React.useState(PAGE_SIZE);
  const query = search.trim().toLowerCase();
  const deferredQuery = React.useDeferredValue(query);

  const counts = React.useMemo(
    () =>
      Object.fromEntries(
        SESSION_KINDS.map(({ kind }) => [
          kind,
          devices.filter(device => device.sessionKinds.includes(kind)).length,
        ]),
      ) as Record<SessionKind, number>,
    [devices],
  );

  const filtered = React.useMemo(
    () =>
      devices.filter(
        device =>
          matchesKinds(device, kinds) &&
          (!deferredQuery ||
            `${deviceName(device)} ${device.ipAddress}`
              .toLowerCase()
              .includes(deferredQuery)),
      ),
    [devices, kinds, deferredQuery, deviceName],
  );

  const updateKinds = (next: SessionKind[]) => {
    setKinds(next);
    setVisible(PAGE_SIZE);
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>{t("title")}</SheetTitle>
        <SheetDescription>
          {t("sheetDesc", { count: devices.length, name: userName })}
        </SheetDescription>
      </SheetHeader>

      <div className="flex items-center gap-2 border-b p-4">
        <InputGroup className="flex-1">
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={t("search")}
            onChange={event => {
              setSearch(event.target.value);
              setVisible(PAGE_SIZE);
            }}
            placeholder={t("search")}
            type="search"
            value={search}
          />
        </InputGroup>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={t("filterLabel", { count: kinds.length })}
                variant="outline"
              />
            }
          >
            <ListFilterIcon aria-hidden="true" />
            <span className="hidden sm:inline">{t("filter")}</span>
            {kinds.length > 0 ? (
              <Badge className="tabular-nums">{kinds.length}</Badge>
            ) : null}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("sessionType")}</DropdownMenuLabel>
              {SESSION_KINDS.map(({ icon: Icon, kind }) => (
                <DropdownMenuCheckboxItem
                  checked={kinds.includes(kind)}
                  key={kind}
                  onCheckedChange={checked => {
                    updateKinds(
                      checked
                        ? [...kinds, kind]
                        : kinds.filter(item => item !== kind),
                    );
                  }}
                >
                  <Icon aria-hidden />
                  {t(kind === "admin" ? "admincp" : "public")}
                  <span className="text-muted-foreground ms-auto text-xs tabular-nums">
                    {counts[kind]}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
            {kinds.length > 0 ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    updateKinds([]);
                  }}
                >
                  <XIcon aria-hidden="true" />
                  {t("clearFilters")}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        aria-busy={query !== deferredQuery}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
      >
        <p
          aria-live="polite"
          className="text-muted-foreground text-xs tabular-nums"
        >
          {t("showing", {
            shown: Math.min(visible, filtered.length),
            total: filtered.length,
          })}
        </p>
        {filtered.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchXIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t("noMatch.title")}</EmptyTitle>
              <EmptyDescription>{t("noMatch.desc")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {filtered.slice(0, visible).map(device => (
              <DeviceRow
                canEdit={canEdit}
                device={device}
                key={device.publicId}
                onRevoke={async () => {
                  await onRevoke(device);
                }}
                userName={userName}
              />
            ))}
          </ul>
        )}
        {filtered.length > visible ? (
          <Button
            className="w-full"
            onClick={() => {
              setVisible(value => value + PAGE_SIZE);
            }}
            size="sm"
            variant="outline"
          >
            <ChevronsDownIcon aria-hidden="true" />
            {t("showMore", {
              count: Math.min(PAGE_SIZE, filtered.length - visible),
            })}
          </Button>
        ) : null}
      </div>

      {canEdit ? (
        <SheetFooter className="flex-row items-center justify-between gap-4 border-t">
          <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {t("signOutAllHint")}
          </span>
          <SignOutAllButton
            count={devices.length}
            onSignOutAll={onSignOutAll}
            userName={userName}
          />
        </SheetFooter>
      ) : null}
    </>
  );
};
