import { useRouter } from "@tanstack/react-router";
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

const importHeaderSearchContent = async () =>
  await import("./header-search-content");

const HeaderSearchContent = React.lazy(async () =>
  importHeaderSearchContent().then(module => ({
    default: module.HeaderSearchContent,
  })),
);

const HeaderSearchSkeleton = () => {
  const t = useTranslations("core.global");

  return (
    <div
      aria-busy
      className="bg-popover/80 ring-foreground/10 flex h-14 items-center gap-3 rounded-2xl px-4 shadow-2xl ring-1 backdrop-blur-sm sm:h-16 sm:px-5"
    >
      <SearchIcon
        aria-hidden
        className="text-muted-foreground size-5 shrink-0 sm:size-6"
      />
      <span className="text-muted-foreground flex-1 truncate text-lg sm:text-xl">
        {t("search_placeholder")}
      </span>
      <Skeleton className="h-5 w-10 rounded-sm max-sm:hidden" />
    </div>
  );
};

const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));

const isOpenShortcut = (event: KeyboardEvent): boolean => {
  if (event.defaultPrevented || event.altKey) return false;
  if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
    return !event.shiftKey;
  }

  return (
    event.key === "/" &&
    !event.metaKey &&
    !event.ctrlKey &&
    !isTypingTarget(event.target)
  );
};

export const HeaderSearch = ({ firstSourceId }: { firstSourceId?: string }) => {
  const t = useTranslations("core.global");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const pendingHrefRef = React.useRef<null | string>(null);
  const [isApple, setIsApple] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect, react-you-might-not-need-an-effect/no-initialize-state, @eslint-react/set-state-in-effect
    setIsApple(/Mac|iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpenShortcut(event)) return;

      event.preventDefault();
      setOpen(prev => (event.key === "/" ? true : !prev));
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handlePrefetch = () => {
    void importHeaderSearchContent();
  };

  const navigateOnClose = (href: string) => {
    pendingHrefRef.current = href;
    setOpen(false);
  };

  const handleOpenChangeComplete = (isOpen: boolean) => {
    if (isOpen) return;

    const href = pendingHrefRef.current;
    pendingHrefRef.current = null;
    if (href) void router.navigate({ href });
  };

  return (
    <>
      <Button
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K /"
        aria-label={t("search_dialog.open")}
        className="md:hidden"
        onClick={() => setOpen(true)}
        onFocus={handlePrefetch}
        onPointerEnter={handlePrefetch}
        size="icon"
        variant="ghost"
      >
        <SearchIcon />
      </Button>

      <InputGroup
        className="hidden w-48 cursor-text select-none md:flex lg:w-64"
        onClick={() => setOpen(true)}
        onPointerEnter={handlePrefetch}
      >
        <button
          aria-haspopup="dialog"
          aria-keyshortcuts="Meta+K Control+K /"
          aria-label={t("search_dialog.open")}
          className="text-muted-foreground h-9 min-w-0 flex-1 cursor-text truncate bg-transparent py-1 ps-1.5 pe-1.5 text-start text-sm outline-none"
          data-slot="input-group-control"
          onFocus={handlePrefetch}
          type="button"
        >
          {t("search_placeholder")}
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
          className="top-4 max-h-none origin-top translate-y-0 gap-0 overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none transition-[opacity,scale,translate] outline-none data-ending-style:-translate-y-1 data-ending-style:scale-98 data-starting-style:-translate-y-2 data-starting-style:scale-97 sm:top-24 sm:max-w-2xl starting:-translate-y-2 starting:scale-97"
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{t("search_dialog.title")}</DialogTitle>
            <DialogDescription>{t("search_dialog.desc")}</DialogDescription>
          </DialogHeader>
          <React.Suspense fallback={<HeaderSearchSkeleton />}>
            <HeaderSearchContent
              firstSourceId={firstSourceId}
              onNavigate={navigateOnClose}
              open={open}
            />
          </React.Suspense>
        </DialogContent>
      </Dialog>
    </>
  );
};
