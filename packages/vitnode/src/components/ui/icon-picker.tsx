import { cn } from "cn";
import React from "react";
import { useTranslations } from "use-intl";

import { humanizeIconName } from "@/lib/emoji-icon";

import { loadLucideIcons } from "./icon-registry";
import { Input } from "./input";

const COLUMNS = 8;
const ROW_HEIGHT = 36;
const OVERSCAN_ROWS = 4;

const matchesSearch = (name: string, terms: string[]) =>
  terms.every(term => name.includes(term));

export const nextIconIndex = ({
  columns,
  count,
  index,
  isRtl,
  key,
}: {
  columns: number;
  count: number;
  index: number;
  isRtl: boolean;
  key: string;
}): null | number => {
  const rowStart = index - (index % columns);
  const step = (offset: number) => {
    const next = index + offset;

    return next >= 0 && next < count ? next : index;
  };

  switch (key) {
    case "ArrowDown":
      return step(columns);
    case "ArrowLeft":
      return step(isRtl ? 1 : -1);
    case "ArrowRight":
      return step(isRtl ? -1 : 1);
    case "ArrowUp":
      return step(-columns);
    case "End":
      return Math.min(rowStart + columns - 1, count - 1);
    case "Home":
      return rowStart;
    default:
      return null;
  }
};

const IconGrid = ({
  height,
  onPreview,
  onSelect,
  search,
  value,
}: {
  height: number;
  onPreview: (name: string | undefined) => void;
  onSelect: (name: string) => void;
  search: string;
  value?: string;
}) => {
  const t = useTranslations("core.global.emoji_icon_picker");
  const { get, names } = React.use(loadLucideIcons());
  const [scroll, setScroll] = React.useState({ search, top: 0 });
  const scrollTop = scroll.search === search ? scroll.top : 0;
  const [active, setActive] = React.useState({ index: 0, search });
  const containerRef = React.useRef<HTMLDivElement>(null);
  const focusPendingRef = React.useRef(false);

  const results = React.useMemo(() => {
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean);

    return terms.length
      ? names.filter(name => matchesSearch(name, terms))
      : names;
  }, [names, search]);

  const activeIndex =
    active.search === search
      ? Math.min(active.index, Math.max(results.length - 1, 0))
      : 0;

  React.useEffect(() => {
    if (!focusPendingRef.current) return;
    focusPendingRef.current = false;

    containerRef.current
      ?.querySelector<HTMLElement>(`[data-icon-index="${activeIndex}"]`)
      ?.focus();
  }, [activeIndex]);

  const moveTo = (index: number) => {
    const container = containerRef.current;
    if (container) {
      const rowTop = Math.floor(index / COLUMNS) * ROW_HEIGHT;
      if (rowTop < container.scrollTop) {
        container.scrollTop = rowTop;
      } else if (rowTop + ROW_HEIGHT > container.scrollTop + height) {
        container.scrollTop = rowTop + ROW_HEIGHT - height;
      }
      setScroll({ search, top: container.scrollTop });
    }

    focusPendingRef.current = true;
    setActive({ index, search });
  };

  if (!results.length) {
    return (
      <div
        className="text-muted-foreground flex items-center justify-center text-sm"
        style={{ height }}
      >
        {t("no_icons")}
      </div>
    );
  }

  const rowCount = Math.ceil(results.length / COLUMNS);
  const firstRow = Math.max(
    0,
    Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS,
  );
  const lastRow = Math.min(
    rowCount,
    Math.ceil((scrollTop + height) / ROW_HEIGHT) + OVERSCAN_ROWS,
  );

  const firstRendered = firstRow * COLUMNS;
  const tabbableIndex =
    activeIndex >= firstRendered && activeIndex < lastRow * COLUMNS
      ? activeIndex
      : firstRendered;

  return (
    <div
      className="overflow-y-auto overscroll-contain"
      key={search}
      onKeyDown={event => {
        const next = nextIconIndex({
          columns: COLUMNS,
          count: results.length,
          index: activeIndex,
          isRtl: getComputedStyle(event.currentTarget).direction === "rtl",
          key: event.key,
        });
        if (next === null) return;

        event.preventDefault();
        moveTo(next);
      }}
      onMouseLeave={() => onPreview(undefined)}
      onScroll={event =>
        setScroll({ search, top: event.currentTarget.scrollTop })
      }
      ref={containerRef}
      style={{ height }}
    >
      <div
        className="relative w-full"
        style={{ height: rowCount * ROW_HEIGHT }}
      >
        <div
          className="absolute inset-x-0 top-0 grid grid-cols-8"
          style={{ transform: `translateY(${firstRow * ROW_HEIGHT}px)` }}
        >
          {results.slice(firstRendered, lastRow * COLUMNS).map((name, at) => {
            const index = firstRendered + at;
            const Icon = get(name);
            const label = humanizeIconName(name);

            if (!Icon) return null;

            return (
              <button
                aria-label={label}
                aria-pressed={value === name}
                className={cn(
                  "text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring ease-fluid flex h-9 items-center justify-center rounded-md transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none",
                  value === name &&
                    "bg-accent text-accent-foreground ring-primary ring-2",
                )}
                data-icon-index={index}
                key={name}
                onClick={() => onSelect(name)}
                onFocus={() => {
                  onPreview(name);
                  if (index !== activeIndex) setActive({ index, search });
                }}
                onMouseEnter={() => onPreview(name)}
                tabIndex={index === tabbableIndex ? 0 : -1}
                title={label}
                type="button"
              >
                {React.createElement(Icon, { className: "size-4.5" })}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const IconPicker = ({
  autoFocus,
  height = 288,
  onSelect,
  value,
}: {
  autoFocus?: boolean;
  height?: number;
  onSelect: (name: string) => void;
  value?: string;
}) => {
  const t = useTranslations("core.global.emoji_icon_picker");
  const [search, setSearch] = React.useState("");
  const [preview, setPreview] = React.useState<string>();

  return (
    <div className="flex flex-col">
      <div className="px-2 pt-2 pb-1">
        <Input
          autoFocus={autoFocus}
          className="bg-muted h-8"
          onChange={event => setSearch(event.target.value)}
          placeholder={t("search_icons")}
          type="search"
          value={search}
        />
      </div>

      <React.Suspense
        fallback={
          <div
            className="text-muted-foreground flex items-center justify-center text-sm"
            style={{ height }}
          >
            {t("loading_icons")}
          </div>
        }
      >
        <IconGrid
          height={height}
          onPreview={setPreview}
          onSelect={onSelect}
          search={search}
          value={value}
        />
      </React.Suspense>

      <div className="flex min-h-11 items-center border-t px-3 py-1">
        <span className="text-muted-foreground truncate text-xs">
          {preview ? humanizeIconName(preview) : t("hint_icon")}
        </span>
      </div>
    </div>
  );
};
