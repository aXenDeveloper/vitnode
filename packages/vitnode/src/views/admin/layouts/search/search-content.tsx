"use client";

import { SearchIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

import type { AdminSearchNavItem } from "./flatten-nav";
import type { SearchAdminDialogContentProps } from "./search-dialog-content";
import type { AdminUserSearch } from "./search-users";

const importSearchAdminDialog = async () =>
  await import("./search-dialog-content");

const SearchAdminDialogContent = React.lazy(async () =>
  importSearchAdminDialog().then(module => ({
    default: module.SearchAdminDialogContent,
  })),
);

export const SearchAdminContent = ({
  items,
  LinkComponent,
  onNavigate,
  searchUsers,
}: {
  items: AdminSearchNavItem[];
  LinkComponent: AuthLinkComponent;
  onNavigate: (href: string) => void;
  /** See {@link SearchAdminDialogContentProps.searchUsers}. */
  searchUsers?: AdminUserSearch;
}) => {
  const t = useTranslations("admin.global");
  const tCore = useTranslations("core.global");

  const [open, setOpen] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);
  const [isApple, setIsApple] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-you-might-not-need-an-effect/no-initialize-state, @eslint-react/set-state-in-effect
    setIsApple(/Mac|iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "k" || (!event.metaKey && !event.ctrlKey)) return;
      if (event.altKey || event.shiftKey || event.defaultPrevented) return;

      event.preventDefault();
      setIsMounted(true);
      setOpen(prev => !prev);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleOpen = () => {
    setIsMounted(true);
    setOpen(true);
  };

  const handlePrefetch = () => {
    void importSearchAdminDialog();
  };

  const dialogProps: Omit<SearchAdminDialogContentProps, "onOpenChange"> = {
    items,
    LinkComponent,
    onNavigate,
    open,
    searchUsers,
  };

  return (
    <>
      <Button
        aria-haspopup="dialog"
        aria-label={t("search.title")}
        className="cursor-text sm:hidden"
        onClick={handleOpen}
        onFocus={handlePrefetch}
        onPointerEnter={handlePrefetch}
        size="icon-sm"
        variant="ghost"
      >
        <SearchIcon />
      </Button>

      <InputGroup
        className="hidden w-42 cursor-text select-none sm:flex xl:w-64"
        onClick={handleOpen}
        onPointerEnter={handlePrefetch}
      >
        <button
          aria-haspopup="dialog"
          aria-keyshortcuts="Meta+K Control+K"
          className="text-muted-foreground h-9 min-w-0 flex-1 cursor-text truncate bg-transparent py-1 ps-1.5 pe-1.5 text-start text-base outline-none md:text-sm"
          data-slot="input-group-control"
          onFocus={handlePrefetch}
          type="button"
        >
          {tCore("search_placeholder")}
        </button>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>

        {isApple !== undefined && (
          <InputGroupAddon align="inline-end" aria-hidden>
            <KbdGroup>
              <Kbd>{isApple ? "⌘" : "Ctrl"}</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          </InputGroupAddon>
        )}
      </InputGroup>

      {isMounted && (
        <React.Suspense fallback={null}>
          <SearchAdminDialogContent {...dialogProps} onOpenChange={setOpen} />
        </React.Suspense>
      )}
    </>
  );
};
