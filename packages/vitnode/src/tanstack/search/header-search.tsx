import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { cn } from "cn";
import { SearchIcon } from "lucide-react";
import React from "react";
import { flushSync } from "react-dom";
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

import type { HeaderSearchContent } from "./header-search-content";

import { useLocale } from "../i18n/locale";
import { HEADER_VIEW_TRANSITION_NAMES } from "../view-transitions";

const PREPARE_BUDGET_MS = 250;

const importHeaderSearchContent = async () =>
  await import("./header-search-content");

const waitFor = async (ms: number) =>
  await new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });

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

type SearchMorphTarget = "dialog" | "trigger";

const MORPH_DIRECTION_ATTRIBUTE = "data-header-search-morph";

const DIALOG_CLASS_NAME =
  "top-4 max-h-none origin-top translate-y-0 gap-0 overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none transition-[opacity,scale,translate] outline-none data-ending-style:-translate-y-1 data-ending-style:scale-98 data-starting-style:-translate-y-2 data-starting-style:scale-97 sm:top-24 sm:max-w-2xl starting:-translate-y-2 starting:scale-97";

const MORPHING_DIALOG_CLASS_NAME =
  "transition-none *:backdrop-blur-none data-starting-style:translate-y-0 data-starting-style:scale-100 data-starting-style:opacity-100";

const canMorph = (): boolean =>
  "startViewTransition" in document &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const morphName = (
  target: SearchMorphTarget,
  morphTarget: null | SearchMorphTarget,
) => (morphTarget === target ? HEADER_VIEW_TRANSITION_NAMES.search : undefined);

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
  const queryClient = useQueryClient();
  const locale = useLocale();
  const [open, setOpen] = React.useState(false);
  const [morphTarget, setMorphTarget] =
    React.useState<null | SearchMorphTarget>(null);
  const morphRef = React.useRef<null | ViewTransition>(null);
  const openingRef = React.useRef(false);
  const prepareRef = React.useRef<null | Promise<void>>(null);
  const [PreparedContent, setPreparedContent] = React.useState<
    null | typeof HeaderSearchContent
  >(null);
  const pendingHrefRef = React.useRef<null | string>(null);
  const [isApple, setIsApple] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect, react-you-might-not-need-an-effect/no-initialize-state, @eslint-react/set-state-in-effect
    setIsApple(/Mac|iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);

  const prepare = async () => {
    prepareRef.current ??= importHeaderSearchContent()
      .then(async module => {
        await module.prepareHeaderSearch({ locale, queryClient });
        setPreparedContent(() => module.HeaderSearchContent);
      })
      .catch(() => {
        prepareRef.current = null;
      });

    await prepareRef.current;
  };

  const morph = (nextOpen: boolean) => {
    const root = document.documentElement;
    // oxlint-disable-next-line @eslint-react/dom-no-flush-sync
    flushSync(() => setMorphTarget(nextOpen ? "trigger" : "dialog"));
    root.setAttribute(MORPH_DIRECTION_ATTRIBUTE, nextOpen ? "open" : "close");

    const transition = document.startViewTransition(() => {
      // oxlint-disable-next-line @eslint-react/dom-no-flush-sync
      flushSync(() => {
        setMorphTarget(nextOpen ? "dialog" : "trigger");
        setOpen(nextOpen);
      });
    });
    morphRef.current = transition;

    void transition.finished.finally(() => {
      if (morphRef.current !== transition) return;

      morphRef.current = null;
      root.removeAttribute(MORPH_DIRECTION_ATTRIBUTE);
      setMorphTarget(null);
    });
  };

  const changeOpen = (nextOpen: boolean) => {
    if (nextOpen === open || openingRef.current) return;
    if (!canMorph()) {
      if (nextOpen) void prepare();
      setOpen(nextOpen);

      return;
    }
    if (!nextOpen) {
      morph(false);

      return;
    }

    openingRef.current = true;
    void Promise.race([prepare(), waitFor(PREPARE_BUDGET_MS)]).then(() => {
      openingRef.current = false;
      morph(true);
    });
  };

  const onShortcut = React.useEffectEvent((event: KeyboardEvent) => {
    if (!isOpenShortcut(event)) return;

    event.preventDefault();
    changeOpen(event.key === "/" ? true : !open);
  });

  React.useEffect(() => {
    window.addEventListener("keydown", onShortcut);

    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  const handlePrefetch = () => {
    void prepare();
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
        className={cn("md:hidden", open && "opacity-0")}
        onClick={() => changeOpen(true)}
        onFocus={handlePrefetch}
        onPointerEnter={handlePrefetch}
        size="icon"
        style={{ viewTransitionName: morphName("trigger", morphTarget) }}
        variant="ghost"
      >
        <SearchIcon />
      </Button>

      <InputGroup
        className={cn(
          "hidden w-48 cursor-text select-none md:flex lg:w-64",
          open && "opacity-0",
        )}
        onClick={() => changeOpen(true)}
        onPointerEnter={handlePrefetch}
        style={{ viewTransitionName: morphName("trigger", morphTarget) }}
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
        onOpenChange={changeOpen}
        onOpenChangeComplete={handleOpenChangeComplete}
        open={open}
      >
        <DialogContent
          className={cn(
            DIALOG_CLASS_NAME,
            morphTarget && MORPHING_DIALOG_CLASS_NAME,
            morphTarget === "trigger" && "invisible",
          )}
          showCloseButton={false}
          style={{ viewTransitionName: morphName("dialog", morphTarget) }}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{t("search_dialog.title")}</DialogTitle>
            <DialogDescription>{t("search_dialog.desc")}</DialogDescription>
          </DialogHeader>
          <React.Suspense fallback={<HeaderSearchSkeleton />}>
            {PreparedContent ? (
              React.createElement(PreparedContent, {
                firstSourceId,
                onNavigate: navigateOnClose,
                open,
              })
            ) : (
              <HeaderSearchSkeleton />
            )}
          </React.Suspense>
        </DialogContent>
      </Dialog>
    </>
  );
};
