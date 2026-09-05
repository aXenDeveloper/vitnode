"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { MenuIcon } from "lucide-react";
import React from "react";
import { useDebouncedCallback } from "use-debounce";
import { useTranslations } from "use-intl";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { Avatar } from "@/components/avatar";
import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { CONFIG_PLUGIN } from "@/config";

import type { AdminSearchNavItem } from "./flatten-nav";
import type { AdminUserSearch } from "./search-users";

import { adminLinkFor } from "../admin-link";
import { isExternalHref } from "../normalize-url";
import {
  MAX_SEARCH_RESULTS,
  MIN_USERS_QUERY_LENGTH,
  USERS_DEBOUNCE_MS,
} from "./constants";
import { matchesAdminNavItem } from "./flatten-nav";
import { adminSearchUsersQueryKey } from "./search-users";
import { splitResultBudget } from "./split-results";

const NavCommandItem = ({
  item,
  LinkComponent,
  onNavigate,
}: {
  item: AdminSearchNavItem;
  LinkComponent: AuthLinkComponent;
  onNavigate: (href: string) => void;
}) => {
  const linkRef = React.useRef<HTMLAnchorElement>(null);
  const content = (
    <>
      {item.icon ?? <MenuIcon />}
      <span className="truncate">{item.title}</span>
      <CommandShortcut className="truncate tracking-normal">
        {item.parentTitle ?? item.groupTitle}
      </CommandShortcut>
    </>
  );

  if (item.isOpenInNewTab || isExternalHref(item.href)) {
    return (
      <CommandItem onSelect={() => linkRef.current?.click()} value={item.href}>
        {/*
         * `createElement` rather than JSX, for the same reason
         * `tanstack/i18n/route-messages` uses it: naming a component that came
         * out of a function in render reads as one *declared* there, which is
         * what `static-components` bans and what would remount a subtree every
         * render. `adminLinkFor` returns one of two module-scope references, so
         * the element type is stable and nothing below it ever remounts.
         */}
        {React.createElement(
          adminLinkFor(item.href, LinkComponent),
          {
            className: "flex min-w-0 flex-1 items-center gap-2",
            href: item.href,
            onClick: (event: React.MouseEvent) => event.stopPropagation(),
            ref: linkRef,
            rel: item.isOpenInNewTab ? "noopener noreferrer" : undefined,
            target: item.isOpenInNewTab ? "_blank" : undefined,
          },
          content,
        )}
      </CommandItem>
    );
  }

  return (
    <CommandItem onSelect={() => onNavigate(item.href)} value={item.href}>
      {content}
    </CommandItem>
  );
};

export interface SearchAdminDialogContentProps {
  items: AdminSearchNavItem[];
  LinkComponent: AuthLinkComponent;
  onNavigate: (href: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;

  searchUsers?: AdminUserSearch;
}

export const SearchAdminDialogContent = ({
  items,
  LinkComponent,
  onNavigate,
  onOpenChange,
  open,
  searchUsers,
}: SearchAdminDialogContentProps) => {
  const t = useTranslations("admin.global");
  const tCore = useTranslations("core.global");

  const [query, setQuery] = React.useState("");
  const [usersQuery, setUsersQuery] = React.useState("");
  const isOpen = React.useDeferredValue(open, false);

  const debounceUsersQuery = useDebouncedCallback(
    setUsersQuery,
    USERS_DEBOUNCE_MS,
  );

  const pendingHrefRef = React.useRef<null | string>(null);

  const canViewUsers = useAdminStaffPermission({
    plugin: CONFIG_PLUGIN.pluginId,
    module: "users",
    permission: "can_view",
  });

  const hasUserSearch = canViewUsers && searchUsers !== undefined;
  const trimmedUsersQuery = usersQuery.trim();
  const canSearchUsers =
    isOpen &&
    hasUserSearch &&
    trimmedUsersQuery.length >= MIN_USERS_QUERY_LENGTH;

  const { data: users, isFetching: isFetchingUsers } = useQuery({
    queryKey: adminSearchUsersQueryKey(trimmedUsersQuery),
    queryFn: async () => (await searchUsers?.(trimmedUsersQuery)) ?? [],
    enabled: canSearchUsers,
    placeholderData: canSearchUsers ? keepPreviousData : undefined,
    staleTime: 30_000,
  });

  const { groupedPages, pagesCount, visibleUsers } = React.useMemo(() => {
    const matched = items.filter(item =>
      matchesAdminNavItem(item, query.trim()),
    );
    const userResults = users ?? [];
    const share = splitResultBudget({
      budget: MAX_SEARCH_RESULTS,
      navCount: matched.length,
      usersCount: userResults.length,
    });
    const groups = new Map<string, AdminSearchNavItem[]>();

    for (const item of matched.slice(0, share.nav)) {
      const group = groups.get(item.groupTitle);

      if (group) {
        group.push(item);
        continue;
      }

      groups.set(item.groupTitle, [item]);
    }

    return {
      groupedPages: [...groups],
      pagesCount: share.nav,
      visibleUsers: userResults.slice(0, share.users),
    };
  }, [items, query, users]);

  const handleChangeQuery = (value: string) => {
    setQuery(value);
    debounceUsersQuery(value);
  };

  const navigateOnClose = (href: string) => {
    debounceUsersQuery.cancel();
    pendingHrefRef.current = href;
    onOpenChange(false);
  };

  const trimmedQuery = query.trim();
  const showUsersHint =
    hasUserSearch &&
    trimmedQuery.length > 0 &&
    trimmedQuery.length < MIN_USERS_QUERY_LENGTH;
  const showUsersSkeleton = isFetchingUsers && !visibleUsers.length;
  const isEmpty =
    !pagesCount && !visibleUsers.length && !showUsersHint && !showUsersSkeleton;

  return (
    <CommandDialog
      description={t("search.desc")}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={isOpen => {
        if (isOpen) return;

        const href = pendingHrefRef.current;
        pendingHrefRef.current = null;
        setQuery("");
        setUsersQuery("");

        if (href) {
          onNavigate(href);
        }
      }}
      open={isOpen}
      title={t("search.title")}
    >
      <Command label={t("search.title")} shouldFilter={false}>
        <CommandInput
          onValueChange={handleChangeQuery}
          placeholder={t("search.placeholder")}
          value={query}
        />

        <CommandList className="max-h-[60vh]">
          {isEmpty && (
            <div className="text-muted-foreground py-6 text-center text-sm">
              {tCore("results_not_found")}
            </div>
          )}

          {groupedPages.map(([groupTitle, groupItems]) => (
            <CommandGroup heading={groupTitle} key={groupTitle}>
              {groupItems.map(item => (
                <NavCommandItem
                  item={item}
                  key={item.href}
                  LinkComponent={LinkComponent}
                  onNavigate={navigateOnClose}
                />
              ))}
            </CommandGroup>
          ))}

          {!!pagesCount &&
            (!!visibleUsers.length || showUsersSkeleton || showUsersHint) && (
              <CommandSeparator />
            )}

          {showUsersHint && (
            <div className="text-muted-foreground py-4 text-center text-xs">
              {t("search.hint", { count: MIN_USERS_QUERY_LENGTH })}
            </div>
          )}

          {showUsersSkeleton && (
            <div className="space-y-1 p-1">
              {["a", "b", "c"].map(id => (
                <Skeleton className="h-8 w-full rounded-lg" key={id} />
              ))}
            </div>
          )}

          {!!visibleUsers.length && (
            <CommandGroup heading={t("nav.users.title")}>
              {visibleUsers.map(user => (
                <CommandItem
                  key={user.id}
                  onSelect={() =>
                    navigateOnClose(`/admin/core/users/${user.id}`)
                  }
                  value={`user-${user.id}`}
                >
                  <Avatar size={20} user={user} />
                  <span className="truncate">{user.name}</span>
                  <CommandShortcut className="truncate tracking-normal">
                    @{user.nameCode}
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
};
