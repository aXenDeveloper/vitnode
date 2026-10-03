import type React from "react";

export interface CascaderOption {
  children?: CascaderOption[];
  disabled?: boolean;
  label: string;
  value: string;
}

export type CascaderLevel = number | string;

export const isCascaderBranch = (option: CascaderOption) =>
  !!option.children?.length;

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

export const isRtl = (element: Element) =>
  getComputedStyle(element).direction === "rtl";

export const panelOf = (element: Element) =>
  element.closest("[data-slot=cascader-panel]");

const enabledOptions = (panel: Element | null, level: CascaderLevel) =>
  [
    ...(panel?.querySelectorAll<HTMLButtonElement>(
      `[data-cascader-level="${level}"]:not([disabled])`,
    ) ?? []),
  ].filter(option => !option.closest("[inert]"));

export const focusOption = (
  panel: Element | null,
  level: CascaderLevel,
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

export const focusLater = (
  panel: Element | null,
  level: number,
  pick: "active" | "first",
) => {
  requestAnimationFrame(() => {
    focusOption(panel, level, pick);
  });
};

interface CascaderKeyboardContext {
  goBack: (panel: Element | null) => void;
  isDrill: boolean;
  level: CascaderLevel;
  openBranch: (
    level: number,
    option: CascaderOption,
    panel: Element | null,
    focusNext: boolean,
  ) => void;
  option: CascaderOption;
  searchable: boolean;
}

const moveWithinLevel = (
  event: React.KeyboardEvent<HTMLButtonElement>,
  panel: Element | null,
  { level, searchable }: CascaderKeyboardContext,
) => {
  const siblings = enabledOptions(panel, level);
  const position = siblings.indexOf(event.currentTarget);

  switch (event.key) {
    case "ArrowDown":
      siblings[Math.min(siblings.length - 1, position + 1)]?.focus();
      break;
    case "ArrowUp":
      if (position <= 0 && searchable) {
        panel
          ?.querySelector<HTMLInputElement>("[data-cascader-search]")
          ?.focus();
      } else {
        siblings[Math.max(0, position - 1)]?.focus();
      }
      break;
    case "End":
      focusOption(panel, level, "last");
      break;
    case "Home":
      focusOption(panel, level, "first");
      break;
    default:
      return false;
  }

  event.preventDefault();

  return true;
};

const moveAcrossLevels = (
  event: React.KeyboardEvent<HTMLButtonElement>,
  panel: Element | null,
  { goBack, isDrill, level, openBranch, option }: CascaderKeyboardContext,
) => {
  if (typeof level !== "number") return;

  const rtl = isRtl(event.currentTarget);
  const forward = rtl ? "ArrowLeft" : "ArrowRight";
  const backward = rtl ? "ArrowRight" : "ArrowLeft";

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
};

export const handleCascaderOptionKeyDown = (
  event: React.KeyboardEvent<HTMLButtonElement>,
  context: CascaderKeyboardContext,
) => {
  const panel = panelOf(event.currentTarget);

  if (!moveWithinLevel(event, panel, context)) {
    moveAcrossLevels(event, panel, context);
  }
};
