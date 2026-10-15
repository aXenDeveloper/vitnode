import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { MenuIcon } from "lucide-react";
import React from "react";
import { useDebouncedCallback } from "use-debounce";
import { useTranslations } from "use-intl";

import { Avatar } from "@/components/avatar";
import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { manifest } from "@/manifest";

import type { AdminSearchNavItem } from "./flatten-nav";
import type { AdminUserSearch } from "./search-users";

import { AdminLink } from "../admin-link";
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
  onNavigate,
}: {
  item: AdminSearchNavItem;
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
        <AdminLink
          className="flex min-w-0 flex-1 items-center gap-2"
          href={item.href}
          onClick={event => event.stopPropagation()}
          ref={linkRef}
          rel={item.isOpenInNewTab ? "noopener noreferrer" : undefined}
          target={item.isOpenInNewTab ? "_blank" : undefined}
        >
          {content}
        </AdminLink>
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
  onNavigate: (href: string) => void;
  open: boolean;

  searchUsers?: AdminUserSearch;
}

export const SearchAdminDialogContent = ({
  items,
  onNavigate,
  open,
  searchUsers,
}: SearchAdminDialogContentProps) => {
  const t = useTranslations("admin.global");
  const tCore = useTranslations("core.global");

  const [query, setQuery] = React.useState("");
  const [usersQuery, setUsersQuery] = React.useState("");

  const debounceUsersQuery = useDebouncedCallback(
    setUsersQuery,
    USERS_DEBOUNCE_MS,
  );

  const canViewUsers = useAdminStaffPermission({
    plugin: manifest.id,
    module: "users",
    permission: "can_view",
  });

  const hasUserSearch = canViewUsers && searchUsers !== undefined;
  const trimmedUsersQuery = usersQuery.trim();
  const canSearchUsers =
    open && hasUserSearch && trimmedUsersQuery.length >= MIN_USERS_QUERY_LENGTH;

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
    onNavigate(href);
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
    <Command label={t("search.title")} shouldFilter={false}>
      <CommandInput
        autoFocus
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
                onSelect={() => navigateOnClose(`/admin/core/users/${user.id}`)}
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
  );
};
