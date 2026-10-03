import { cn } from "cn";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
} from "motion/react";
import React from "react";
import { useTranslations } from "use-intl";

import { useIsMobile } from "@/hooks/use-mobile";

import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface CascaderOption {
  children?: CascaderOption[];
  disabled?: boolean;
  label: string;
  value: string;
}

const COLUMN_WIDTH = 224;
const PANEL_TRANSITION = { type: "spring", duration: 0.3, bounce: 0 } as const;

const isCascaderBranch = (option: CascaderOption) => !!option.children?.length;

export const findCascaderPath = (
  options: readonly CascaderOption[],
  value: string,
): CascaderOption[] => {
  for (const option of options) {
    if (option.value === value) return [option];

    if (option.children) {
      const rest = findCascaderPath(option.children, value);
      if (rest.length) return [option, ...rest];
    }
  }

  return [];
};

const normalizeLabel = (label: string) =>
  label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export const searchCascader = (
  options: readonly CascaderOption[],
  query: string,
  limit = 50,
): CascaderOption[][] => {
  const needle = normalizeLabel(query.trim());
  if (!needle) return [];

  const results: CascaderOption[][] = [];
  const walk = (
    list: readonly CascaderOption[],
    trail: readonly CascaderOption[],
  ) => {
    for (const option of list) {
      if (results.length >= limit) return;
      const path = [...trail, option];

      if (option.children?.length) {
        walk(option.children, path);
      } else if (
        path.some(node => normalizeLabel(node.label).includes(needle))
      ) {
        results.push(path);
      }
    }
  };
  walk(options, []);

  return results;
};

export const cascaderColumns = (
  options: CascaderOption[],
  activePath: readonly string[],
): CascaderOption[][] => {
  const columns = [options];
  let level = options;

  for (const value of activePath) {
    const node = level.find(option => option.value === value);
    if (!node?.children?.length) break;

    columns.push(node.children);
    level = node.children;
  }

  return columns;
};

const focusLater = (
  panel: Element | null,
  level: number,
  pick: "active" | "first",
) => {
  requestAnimationFrame(() => {
    focusOption(panel, level, pick);
  });
};

const assignRef = <T,>(ref: React.Ref<T> | undefined, value: null | T) => {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
};

const PresentColumn = ({
  children,
  className,
  onHeightChange,
  ref,
  ...props
}: React.ComponentProps<typeof motion.div> & {
  onHeightChange?: (height: number) => void;
}) => {
  const isPresent = useIsPresent();
  const observesHeight = isPresent && !!onHeightChange;

  return (
    <motion.div
      className={className}
      inert={!isPresent}
      ref={(node: HTMLDivElement | null) => {
        assignRef(ref, node);
        if (!node || !observesHeight || typeof ResizeObserver === "undefined") {
          return;
        }

        const observer = new ResizeObserver(([entry]) => {
          onHeightChange(
            entry?.borderBoxSize[0]?.blockSize ?? node.offsetHeight,
          );
        });
        observer.observe(node);

        return () => {
          observer.disconnect();
          assignRef(ref, null);
        };
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
};

const DRILL_VARIANTS = {
  center: { opacity: 1, x: "0%" },
  enter: (offset: number) => ({ opacity: 0, x: `${offset * 40}%` }),
  exit: (offset: number) => ({ opacity: 0, x: `${offset * -40}%` }),
};

const isRtl = (element: Element) =>
  getComputedStyle(element).direction === "rtl";

const panelOf = (element: Element) =>
  element.closest("[data-slot=cascader-panel]");

const enabledOptions = (panel: Element | null, level: number | string) =>
  [
    ...(panel?.querySelectorAll<HTMLButtonElement>(
      `[data-cascader-level="${level}"]:not([disabled])`,
    ) ?? []),
  ].filter(option => !option.closest("[inert]"));

const focusOption = (
  panel: Element | null,
  level: number | string,
  pick: "active" | "first" | "last",
) => {
  const options = enabledOptions(panel, level);
  const target =
    pick === "first"
      ? options[0]
      : pick === "last"
        ? options.at(-1)
        : (options.find(option => option.dataset.active === "true") ??
          options[0]);

  target?.focus();
};

function Cascader({
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-labelledby": ariaLabelledBy,
  className,
  defaultValue = null,
  disabled = false,
  expandTrigger = "click",
  id,
  layout = "drill",
  onValueChange,
  options,
  placeholder,
  searchable = false,
  separator = " / ",
  showClear = false,
  value: valueProp,
}: {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-labelledby"?: string;
  className?: string;
  defaultValue?: null | string;
  disabled?: boolean;
  expandTrigger?: "click" | "hover";
  id?: string;
  layout?: "columns" | "drill";
  onValueChange?: (value: null | string, path: CascaderOption[]) => void;
  options: CascaderOption[];
  placeholder?: string;
  searchable?: boolean;
  separator?: string;
  showClear?: boolean;
  value?: null | string;
}) {
  const t = useTranslations("core.global");
  const isMobile = useIsMobile();
  const isDrill = isMobile || layout === "drill";
  const shouldReduceMotion = useReducedMotion();
  const [uncontrolledValue, setUncontrolledValue] =
    React.useState(defaultValue);
  const value = valueProp === undefined ? uncontrolledValue : valueProp;
  const selectedPath = React.useMemo(
    () => (value === null ? [] : findCascaderPath(options, value)),
    [options, value],
  );
  const [open, setOpen] = React.useState(false);
  const [activePath, setActivePath] = React.useState<string[]>([]);
  const [direction, setDirection] = React.useState<-1 | 1>(1);
  const [query, setQuery] = React.useState("");
  const [levelHeight, setLevelHeight] = React.useState<null | number>(null);
  const columns = cascaderColumns(options, activePath);
  const results = searchable && query ? searchCascader(options, query) : null;
  const transition = shouldReduceMotion ? { duration: 0 } : PANEL_TRANSITION;
  const selectedValues = new Set(selectedPath.map(option => option.value));

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setActivePath(selectedPath.slice(0, -1).map(option => option.value));
      setQuery("");
      setDirection(1);
    }
    setOpen(next);
  };

  const commit = (path: CascaderOption[]) => {
    const leaf = path.at(-1) ?? null;
    setUncontrolledValue(leaf?.value ?? null);
    onValueChange?.(leaf?.value ?? null, path);
  };

  const pathTo = (level: number, option: CascaderOption) => [
    ...columns
      .slice(0, level)
      .map((column, index) =>
        column.find(node => node.value === activePath[index]),
      )
      .filter(node => node !== undefined),
    option,
  ];

  const openBranch = (
    level: number,
    option: CascaderOption,
    panel: Element | null,
    focusNext: boolean,
  ) => {
    setDirection(panel && isRtl(panel) ? -1 : 1);
    setActivePath(current => [...current.slice(0, level), option.value]);
    if (focusNext) focusLater(panel, level + 1, "first");
  };

  const goBack = (panel: Element | null) => {
    setDirection(panel && isRtl(panel) ? 1 : -1);
    focusLater(panel, Math.max(0, activePath.length - 1), "active");
    setActivePath(current => current.slice(0, -1));
  };

  const choose = (
    level: number,
    option: CascaderOption,
    panel: Element | null,
  ) => {
    if (option.disabled) return;

    if (isCascaderBranch(option)) {
      openBranch(level, option, panel, isDrill);

      return;
    }

    commit(pathTo(level, option));
    setOpen(false);
  };

  const handleOptionKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    level: number | string,
    option: CascaderOption,
  ) => {
    const rtl = isRtl(event.currentTarget);
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const backward = rtl ? "ArrowRight" : "ArrowLeft";
    const panel = panelOf(event.currentTarget);
    const siblings = enabledOptions(panel, level);
    const position = siblings.indexOf(event.currentTarget);

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        siblings[Math.min(siblings.length - 1, position + 1)]?.focus();
        break;
      case "ArrowUp":
        event.preventDefault();
        if (position <= 0 && searchable) {
          panel
            ?.querySelector<HTMLInputElement>("[data-cascader-search]")
            ?.focus();
        } else {
          siblings[Math.max(0, position - 1)]?.focus();
        }
        break;
      case "End":
        event.preventDefault();
        focusOption(panel, level, "last");
        break;
      case "Home":
        event.preventDefault();
        focusOption(panel, level, "first");
        break;
      default:
        if (typeof level !== "number") return;

        if (event.key === forward && isCascaderBranch(option)) {
          event.preventDefault();
          openBranch(level, option, panel, true);
        } else if (event.key === backward && level > 0) {
          event.preventDefault();
          if (isDrill) {
            goBack(panel);
          } else {
            focusOption(panel, level - 1, "active");
          }
        }
    }
  };

  const renderOption = (
    option: CascaderOption,
    level: number | string,
    index: number,
    label: React.ReactNode,
    onSelect: (panel: Element | null) => void,
  ) => {
    const isBranch = isCascaderBranch(option);
    const isActive =
      typeof level === "number" && activePath[level] === option.value;
    const isSelected =
      typeof level === "number"
        ? selectedValues.has(option.value)
        : option.value === value;

    return (
      <button
        aria-expanded={isBranch ? isActive : undefined}
        aria-selected={isSelected}
        className={cn(
          "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground data-[active=true]:bg-accent/60 flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-start text-sm outline-none disabled:pointer-events-none disabled:opacity-50",
          isSelected && !isBranch && "font-medium",
        )}
        data-active={isActive || (isSelected && !isBranch)}
        data-cascader-level={level}
        disabled={option.disabled}
        key={option.value}
        onClick={event => {
          onSelect(panelOf(event.currentTarget));
        }}
        onKeyDown={event => {
          handleOptionKeyDown(event, level, option);
        }}
        onMouseEnter={() => {
          if (
            expandTrigger === "hover" &&
            isBranch &&
            !isDrill &&
            typeof level === "number" &&
            !isActive
          ) {
            openBranch(level, option, null, false);
          }
        }}
        role="option"
        tabIndex={index === 0 ? 0 : -1}
        type="button"
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {isBranch ? (
          <ChevronRightIcon className="text-muted-foreground size-4 shrink-0 rtl:rotate-180" />
        ) : isSelected ? (
          <CheckIcon className="size-4 shrink-0" />
        ) : null}
      </button>
    );
  };

  const renderColumn = (column: CascaderOption[], level: number) => (
    <div
      aria-label={
        level === 0
          ? (placeholder ?? t("select_option"))
          : columns[level - 1]?.find(
              node => node.value === activePath[level - 1],
            )?.label
      }
      className="flex max-h-72 flex-col overflow-y-auto overscroll-contain p-1"
      role="listbox"
    >
      {column.map((option, index) =>
        renderOption(option, level, index, option.label, panel => {
          choose(level, option, panel);
        }),
      )}
    </div>
  );

  const renderPanel = () => {
    if (results) {
      if (results.length === 0) {
        return (
          <p
            className={cn(
              "text-muted-foreground px-3 py-6 text-center text-sm",
              !isDrill && "w-80",
            )}
          >
            {t("results_not_found")}
          </p>
        );
      }

      return (
        <div
          aria-label={t("search_placeholder")}
          className={cn(
            "flex max-h-72 flex-col overflow-y-auto overscroll-contain p-1",
            !isDrill && "w-80",
          )}
          role="listbox"
        >
          {results.map((path, index) => {
            const leaf = path.at(-1);
            if (!leaf) return null;

            return renderOption(
              leaf,
              "search",
              index,
              path.map(node => node.label).join(separator),
              () => {
                commit(path);
                setOpen(false);
              },
            );
          })}
        </div>
      );
    }

    if (isDrill) {
      const level = columns.length - 1;
      const parent = columns[level - 1]?.find(
        node => node.value === activePath[level - 1],
      );

      return (
        <motion.div
          animate={{ height: levelHeight ?? "auto" }}
          className="relative overflow-hidden"
          initial={false}
          transition={transition}
        >
          <AnimatePresence custom={direction} initial={false} mode="popLayout">
            <PresentColumn
              animate="center"
              className="w-full"
              custom={direction}
              exit="exit"
              initial="enter"
              key={activePath.slice(0, level).join("/") || "root"}
              onHeightChange={setLevelHeight}
              transition={transition}
              variants={DRILL_VARIANTS}
            >
              {parent && (
                <button
                  className="hover:bg-accent text-muted-foreground focus-visible:bg-accent flex w-full items-center gap-1 border-b px-2 py-2 text-start text-sm outline-none"
                  onClick={event => {
                    goBack(panelOf(event.currentTarget));
                  }}
                  type="button"
                >
                  <ChevronLeftIcon className="size-4 rtl:rotate-180" />
                  <span className="sr-only">{t("go_back")}: </span>
                  <span className="text-foreground truncate font-medium">
                    {parent.label}
                  </span>
                </button>
              )}
              {renderColumn(columns[level] ?? [], level)}
            </PresentColumn>
          </AnimatePresence>
        </motion.div>
      );
    }

    return (
      <motion.div
        animate={{ width: columns.length * COLUMN_WIDTH }}
        className="flex max-w-(--available-width) overflow-x-auto overflow-y-hidden"
        initial={false}
        transition={transition}
      >
        <AnimatePresence initial={false}>
          {columns.map((column, level) => (
            <PresentColumn
              animate={{ opacity: 1, x: 0 }}
              className="shrink-0 border-e last:border-e-0"
              exit={{ opacity: 0, x: -8 }}
              initial={{ opacity: 0, x: -8 }}
              key={["root", ...activePath.slice(0, level)].join("/")}
              style={{ width: COLUMN_WIDTH }}
              transition={transition}
            >
              {renderColumn(column, level)}
            </PresentColumn>
          ))}
        </AnimatePresence>
      </motion.div>
    );
  };

  const hasValue = selectedPath.length > 0;

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <div className={cn("relative w-full", className)} data-slot="cascader">
        <PopoverTrigger
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          aria-labelledby={ariaLabelledBy}
          className={cn(
            "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 hover:bg-muted dark:bg-input/30 dark:hover:bg-input/50 bg-card flex h-9 w-full items-center justify-between gap-1.5 rounded-md border py-2 ps-2.5 pe-2 text-start text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3",
          )}
          disabled={disabled}
          id={id}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              !hasValue && "text-muted-foreground",
              showClear && hasValue && !disabled && "me-7",
            )}
            data-slot="cascader-value"
          >
            {hasValue
              ? selectedPath.map(option => option.label).join(separator)
              : (placeholder ?? t("select_option"))}
          </span>
          <ChevronDownIcon className="text-muted-foreground pointer-events-none size-4 shrink-0" />
        </PopoverTrigger>
        {showClear && hasValue && !disabled && (
          <button
            aria-label={t("clear")}
            className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 absolute end-8 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm outline-none focus-visible:ring-3"
            onClick={() => {
              commit([]);
            }}
            type="button"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>

      <PopoverContent
        align="start"
        className={cn(
          "w-auto max-w-(--available-width) gap-0 overflow-hidden p-0",
          isDrill && "w-(--anchor-width)",
        )}
      >
        <div data-slot="cascader-panel">
          {searchable && (
            <div className="flex items-center gap-2 border-b px-3">
              <SearchIcon className="text-muted-foreground size-4 shrink-0" />
              <input
                aria-label={t("search_placeholder")}
                className="placeholder:text-muted-foreground h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
                data-cascader-search=""
                onChange={event => {
                  setQuery(event.target.value);
                }}
                onKeyDown={event => {
                  if (event.key !== "ArrowDown") return;

                  event.preventDefault();
                  focusOption(
                    panelOf(event.currentTarget),
                    results ? "search" : 0,
                    "active",
                  );
                }}
                placeholder={t("search_placeholder")}
                type="text"
                value={query}
              />
            </div>
          )}
          {renderPanel()}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { Cascader };
