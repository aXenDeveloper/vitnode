import { cn } from "cn";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { AnimatePresence, useIsPresent, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import React from "react";
import { useTranslations } from "use-intl";

import { MotionFeatures } from "@/components/motion-features";
import { useIsMobile } from "@/hooks/use-mobile";

import {
  cascaderColumns,
  type CascaderLevel,
  type CascaderOption,
  findCascaderPath,
  focusLater,
  focusOption,
  handleCascaderOptionKeyDown,
  isCascaderBranch,
  isRtl,
  panelOf,
  searchCascader,
} from "./cascader-utils";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export type { CascaderOption } from "./cascader-utils";

const COLUMN_WIDTH = 224;
const PANEL_TRANSITION = { type: "spring", duration: 0.3, bounce: 0 } as const;

const DRILL_VARIANTS = {
  center: { opacity: 1, x: "0%" },
  enter: (offset: number) => ({ opacity: 0, x: `${offset * 40}%` }),
  exit: (offset: number) => ({ opacity: 0, x: `${offset * -40}%` }),
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
}: React.ComponentProps<typeof m.div> & {
  onHeightChange?: (height: number) => void;
}) => {
  const isPresent = useIsPresent();
  const observesHeight = isPresent && !!onHeightChange;

  return (
    <m.div
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
    </m.div>
  );
};

interface CascaderProps {
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
}

const useCascaderValue = ({
  defaultValue,
  onValueChange,
  options,
  value: valueProp,
}: Pick<CascaderProps, "onValueChange" | "options" | "value"> & {
  defaultValue: null | string;
}) => {
  const [uncontrolledValue, setUncontrolledValue] =
    React.useState(defaultValue);
  const value = valueProp === undefined ? uncontrolledValue : valueProp;
  const selectedPath = React.useMemo(
    () => (value === null ? [] : findCascaderPath(options, value)),
    [options, value],
  );

  const commit = (path: CascaderOption[]) => {
    const leaf = path.at(-1) ?? null;
    setUncontrolledValue(leaf?.value ?? null);
    onValueChange?.(leaf?.value ?? null, path);
  };

  return { commit, selectedPath, value };
};

const useCascader = ({
  expandTrigger,
  isDrill,
  options,
  placeholder,
  searchable,
  separator,
  ...valueOptions
}: Pick<
  CascaderProps,
  "onValueChange" | "options" | "placeholder" | "value"
> & {
  defaultValue: null | string;
  expandTrigger: "click" | "hover";
  isDrill: boolean;
  searchable: boolean;
  separator: string;
}) => {
  const listboxBaseId = React.useId();
  const shouldReduceMotion = useReducedMotion();
  const { commit, selectedPath, value } = useCascaderValue({
    options,
    ...valueOptions,
  });
  const [open, setOpen] = React.useState(false);
  const [activePath, setActivePath] = React.useState<string[]>([]);
  const [direction, setDirection] = React.useState<-1 | 1>(1);
  const [query, setQuery] = React.useState("");
  const [levelHeight, setLevelHeight] = React.useState<null | number>(null);
  const columns = cascaderColumns(options, activePath);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setActivePath(selectedPath.slice(0, -1).map(option => option.value));
      setQuery("");
      setDirection(1);
    }
    setOpen(next);
  };

  const commitAndClose = (path: CascaderOption[]) => {
    commit(path);
    setOpen(false);
  };

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

  const pathTo = (level: number, option: CascaderOption) => [
    ...columns
      .slice(0, level)
      .map((column, index) =>
        column.find(node => node.value === activePath[index]),
      )
      .filter(node => node !== undefined),
    option,
  ];

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

    commitAndClose(pathTo(level, option));
  };

  return {
    activePath,
    choose,
    columnId: (level: number) => `${listboxBaseId}-column-${level}`,
    columns,
    commit,
    commitAndClose,
    direction,
    expandTrigger,
    goBack,
    handleOpenChange,
    isDrill,
    levelHeight,
    open,
    openBranch,
    placeholder,
    query,
    results: searchable && query ? searchCascader(options, query) : null,
    searchable,
    selectedPath,
    selectedValues: new Set(selectedPath.map(option => option.value)),
    separator,
    setLevelHeight,
    setQuery,
    transition: shouldReduceMotion ? { duration: 0 } : PANEL_TRANSITION,
    value,
  };
};

type CascaderController = ReturnType<typeof useCascader>;

const CascaderOptionItem = ({
  cascader,
  index,
  label,
  level,
  onSelect,
  option,
}: {
  cascader: CascaderController;
  index: number;
  label: React.ReactNode;
  level: CascaderLevel;
  onSelect: (panel: Element | null) => void;
  option: CascaderOption;
}) => {
  const isBranch = isCascaderBranch(option);
  const isColumnLevel = typeof level === "number";
  const isActive = isColumnLevel && cascader.activePath[level] === option.value;
  const isSelected = isColumnLevel
    ? cascader.selectedValues.has(option.value)
    : option.value === cascader.value;
  const opensOnHover =
    cascader.expandTrigger === "hover" && isBranch && !cascader.isDrill;

  return (
    <button
      aria-controls={
        isActive && !cascader.isDrill ? cascader.columnId(level + 1) : undefined
      }
      aria-current={isActive || undefined}
      aria-selected={isSelected}
      className={cn(
        "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground data-[active=true]:bg-accent/60 flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-start text-sm outline-none disabled:pointer-events-none disabled:opacity-50",
        isSelected && !isBranch && "font-medium",
      )}
      data-active={isActive || (isSelected && !isBranch)}
      data-cascader-level={level}
      disabled={option.disabled}
      onClick={event => {
        onSelect(panelOf(event.currentTarget));
      }}
      onKeyDown={event => {
        handleCascaderOptionKeyDown(event, {
          goBack: cascader.goBack,
          isDrill: cascader.isDrill,
          level,
          openBranch: cascader.openBranch,
          option,
          searchable: cascader.searchable,
        });
      }}
      onMouseEnter={() => {
        if (opensOnHover && isColumnLevel && !isActive) {
          cascader.openBranch(level, option, null, false);
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

const CascaderColumn = ({
  cascader,
  column,
  level,
}: {
  cascader: CascaderController;
  column: CascaderOption[];
  level: number;
}) => {
  const t = useTranslations("core.global");
  const parent = cascader.columns[level - 1]?.find(
    node => node.value === cascader.activePath[level - 1],
  );

  return (
    <div
      aria-label={
        level === 0
          ? (cascader.placeholder ?? t("select_option"))
          : parent?.label
      }
      className="flex max-h-72 flex-col overflow-y-auto overscroll-contain p-1"
      id={cascader.columnId(level)}
      role="listbox"
    >
      {column.map((option, index) => (
        <CascaderOptionItem
          cascader={cascader}
          index={index}
          key={option.value}
          label={option.label}
          level={level}
          onSelect={panel => {
            cascader.choose(level, option, panel);
          }}
          option={option}
        />
      ))}
    </div>
  );
};

const CascaderSearchResults = ({
  cascader,
  results,
}: {
  cascader: CascaderController;
  results: CascaderOption[][];
}) => {
  const t = useTranslations("core.global");

  if (results.length === 0) {
    return (
      <p
        className={cn(
          "text-muted-foreground px-3 py-6 text-center text-sm",
          !cascader.isDrill && "w-80",
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
        !cascader.isDrill && "w-80",
      )}
      role="listbox"
    >
      {results.map((path, index) => {
        const leaf = path.at(-1);
        if (!leaf) return null;

        return (
          <CascaderOptionItem
            cascader={cascader}
            index={index}
            key={leaf.value}
            label={path.map(node => node.label).join(cascader.separator)}
            level="search"
            onSelect={() => {
              cascader.commitAndClose(path);
            }}
            option={leaf}
          />
        );
      })}
    </div>
  );
};

const CascaderDrillView = ({ cascader }: { cascader: CascaderController }) => {
  const t = useTranslations("core.global");
  const { activePath, columns, direction, transition } = cascader;
  const level = columns.length - 1;
  const parent = columns[level - 1]?.find(
    node => node.value === activePath[level - 1],
  );

  return (
    <MotionFeatures>
      <m.div
        animate={{ height: cascader.levelHeight ?? "auto" }}
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
            onHeightChange={cascader.setLevelHeight}
            transition={transition}
            variants={DRILL_VARIANTS}
          >
            {parent && (
              <button
                className="hover:bg-accent text-muted-foreground focus-visible:bg-accent flex w-full items-center gap-1 border-b px-2 py-2 text-start text-sm outline-none"
                onClick={event => {
                  cascader.goBack(panelOf(event.currentTarget));
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
            <CascaderColumn
              cascader={cascader}
              column={columns[level] ?? []}
              level={level}
            />
          </PresentColumn>
        </AnimatePresence>
      </m.div>
    </MotionFeatures>
  );
};

const CascaderColumnsView = ({
  cascader,
}: {
  cascader: CascaderController;
}) => (
  <MotionFeatures>
    <m.div
      animate={{ width: cascader.columns.length * COLUMN_WIDTH }}
      className="flex max-w-(--available-width) overflow-x-auto overflow-y-hidden"
      initial={false}
      transition={cascader.transition}
    >
      <AnimatePresence initial={false}>
        {cascader.columns.map((column, level) => (
          <PresentColumn
            animate={{ opacity: 1, x: 0 }}
            className="shrink-0 border-e last:border-e-0"
            exit={{ opacity: 0, x: -8 }}
            initial={{ opacity: 0, x: -8 }}
            key={["root", ...cascader.activePath.slice(0, level)].join("/")}
            style={{ width: COLUMN_WIDTH }}
            transition={cascader.transition}
          >
            <CascaderColumn cascader={cascader} column={column} level={level} />
          </PresentColumn>
        ))}
      </AnimatePresence>
    </m.div>
  </MotionFeatures>
);

const CascaderSearchInput = ({
  cascader,
}: {
  cascader: CascaderController;
}) => {
  const t = useTranslations("core.global");

  return (
    <div className="flex items-center gap-2 border-b px-3">
      <SearchIcon className="text-muted-foreground size-4 shrink-0" />
      <input
        aria-label={t("search_placeholder")}
        className="placeholder:text-muted-foreground h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
        data-cascader-search=""
        onChange={event => {
          cascader.setQuery(event.target.value);
        }}
        onKeyDown={event => {
          if (event.key !== "ArrowDown") return;

          event.preventDefault();
          focusOption(
            panelOf(event.currentTarget),
            cascader.results ? "search" : 0,
            "active",
          );
        }}
        placeholder={t("search_placeholder")}
        type="text"
        value={cascader.query}
      />
    </div>
  );
};

const CascaderPanel = ({ cascader }: { cascader: CascaderController }) => {
  if (cascader.results) {
    return (
      <CascaderSearchResults cascader={cascader} results={cascader.results} />
    );
  }

  return cascader.isDrill ? (
    <CascaderDrillView cascader={cascader} />
  ) : (
    <CascaderColumnsView cascader={cascader} />
  );
};

const CascaderTrigger = ({
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-labelledby": ariaLabelledBy,
  cascader,
  className,
  disabled,
  id,
  showClear,
}: Pick<
  CascaderProps,
  "aria-describedby" | "aria-invalid" | "aria-labelledby" | "className" | "id"
> & {
  cascader: CascaderController;
  disabled: boolean;
  showClear: boolean;
}) => {
  const t = useTranslations("core.global");
  const hasValue = cascader.selectedPath.length > 0;
  const canClear = showClear && hasValue && !disabled;

  return (
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
            canClear && "me-7",
          )}
          data-slot="cascader-value"
        >
          {hasValue
            ? cascader.selectedPath
                .map(option => option.label)
                .join(cascader.separator)
            : (cascader.placeholder ?? t("select_option"))}
        </span>
        <ChevronDownIcon className="text-muted-foreground pointer-events-none size-4 shrink-0" />
      </PopoverTrigger>
      {canClear && (
        <button
          aria-label={t("clear")}
          className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 absolute end-8 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm outline-none focus-visible:ring-3"
          onClick={() => {
            cascader.commit([]);
          }}
          type="button"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
};

const Cascader = ({
  defaultValue = null,
  disabled = false,
  expandTrigger = "click",
  layout = "drill",
  onValueChange,
  options,
  placeholder,
  searchable = false,
  separator = " / ",
  showClear = false,
  value,
  ...triggerProps
}: CascaderProps) => {
  const isMobile = useIsMobile();
  const isDrill = isMobile || layout === "drill";
  const cascader = useCascader({
    defaultValue,
    expandTrigger,
    isDrill,
    onValueChange,
    options,
    placeholder,
    searchable,
    separator,
    value,
  });

  return (
    <Popover onOpenChange={cascader.handleOpenChange} open={cascader.open}>
      <CascaderTrigger
        cascader={cascader}
        disabled={disabled}
        showClear={showClear}
        {...triggerProps}
      />
      <PopoverContent
        align="start"
        className={cn(
          "w-auto max-w-(--available-width) gap-0 overflow-hidden p-0",
          isDrill && "w-(--anchor-width)",
        )}
      >
        <div data-slot="cascader-panel">
          {searchable && <CascaderSearchInput cascader={cascader} />}
          <CascaderPanel cascader={cascader} />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export { Cascader };
