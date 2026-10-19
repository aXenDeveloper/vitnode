import { SearchIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";

import type { AdminSearchNavItem } from "./flatten-nav";
import type { SearchAdminDialogContentProps } from "./search-dialog-content";

const importSearchAdminDialog = async () =>
  await import("./search-dialog-content");

const SearchAdminDialogContent = React.lazy(async () =>
  importSearchAdminDialog().then(module => ({
    default: module.SearchAdminDialogContent,
  })),
);

const SKELETON_ROWS = ["a", "b", "c", "d", "e"];

const SearchAdminDialogSkeleton = () => {
  const t = useTranslations("admin.global");

  return (
    <div aria-busy className="flex flex-col overflow-hidden rounded-xl p-1">
      <div className="p-1 pb-0">
        <InputGroup className="border-input/30 bg-input/30 h-8 rounded-lg shadow-none">
          <span className="text-muted-foreground flex-1 truncate ps-1.5 text-sm">
            {t("search.placeholder")}
          </span>
          <InputGroupAddon>
            <SearchIcon className="size-4 shrink-0 opacity-50" />
          </InputGroupAddon>
        </InputGroup>
      </div>
      <div className="flex flex-col gap-1 p-2">
        <Skeleton className="my-1.5 h-3 w-20 rounded-sm" />
        {SKELETON_ROWS.map(id => (
          <Skeleton className="h-8 w-full rounded-md" key={id} />
        ))}
      </div>
    </div>
  );
};

export const SearchAdminContent = ({
  items,
  onNavigate,
  searchUsers,
}: {
  items: AdminSearchNavItem[];
  onNavigate: (href: string) => void;
  /** See {@link SearchAdminDialogContentProps.searchUsers}. */
  searchUsers?: SearchAdminDialogContentProps["searchUsers"];
}) => {
  const t = useTranslations("admin.global");
  const tCore = useTranslations("core.global");

  const [open, setOpen] = React.useState(false);
  const pendingHrefRef = React.useRef<null | string>(null);
  const [isApple, setIsApple] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect, react-you-might-not-need-an-effect/no-initialize-state, @eslint-react/set-state-in-effect
    setIsApple(/Mac|iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "k" || (!event.metaKey && !event.ctrlKey)) return;
      if (event.altKey || event.shiftKey || event.defaultPrevented) return;

      event.preventDefault();
      setOpen(prev => !prev);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleOpen = () => {
    setOpen(true);
  };

  const handlePrefetch = () => {
    void importSearchAdminDialog();
  };

  const navigateOnClose = (href: string) => {
    pendingHrefRef.current = href;
    setOpen(false);
  };

  const handleOpenChangeComplete = (isOpen: boolean) => {
    if (isOpen) return;

    const href = pendingHrefRef.current;
    pendingHrefRef.current = null;

    if (href) {
      onNavigate(href);
    }
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

      <Dialog
        onOpenChange={setOpen}
        onOpenChangeComplete={handleOpenChangeComplete}
        open={open}
      >
        <DialogContent
          className="bg-popover/80 top-1/3 max-h-[calc(66.667vh-2rem)] translate-y-0 grid-rows-[minmax(0,1fr)] overflow-hidden rounded-xl p-0 backdrop-blur-sm outline-none sm:max-h-[calc(66.667vh-5rem)]"
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{t("search.title")}</DialogTitle>
            <DialogDescription>{t("search.desc")}</DialogDescription>
          </DialogHeader>
          <React.Suspense fallback={<SearchAdminDialogSkeleton />}>
            <SearchAdminDialogContent
              items={items}
              onNavigate={navigateOnClose}
              open={open}
              searchUsers={searchUsers}
            />
          </React.Suspense>
        </DialogContent>
      </Dialog>
    </>
  );
};
