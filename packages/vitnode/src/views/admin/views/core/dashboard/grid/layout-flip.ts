const WIDGET_SELECTOR = "[data-dashboard-widget]";

const FLIP_ID = "dashboard-layout-flip";

const FLIP_TIMING: KeyframeAnimationOptions = {
  duration: 220,
  easing: "cubic-bezier(0.23, 1, 0.32, 1)",
};

export type LayoutSnapshot = ReadonlyMap<string, DOMRect>;

const widgetsIn = (grid: HTMLElement): HTMLElement[] => [
  ...grid.querySelectorAll<HTMLElement>(WIDGET_SELECTOR),
];

const moved = (from: number, to: number): boolean => Math.abs(from - to) > 0.5;

export const snapshotLayout = (
  grid: HTMLElement | null,
): LayoutSnapshot | null =>
  grid === null
    ? null
    : new Map(
        widgetsIn(grid).map(node => [
          node.dataset.dashboardWidget ?? "",
          node.getBoundingClientRect(),
        ]),
      );

export const playLayoutFlip = (
  grid: HTMLElement | null,
  before: LayoutSnapshot | null,
): void => {
  if (grid === null || before === null) return;

  for (const node of widgetsIn(grid)) {
    const from = before.get(node.dataset.dashboardWidget ?? "");
    if (!from) continue;

    for (const running of node.getAnimations()) {
      if (running.id === FLIP_ID) running.cancel();
    }

    const to = node.getBoundingClientRect();
    const resized =
      moved(from.width, to.width) || moved(from.height, to.height);
    if (!resized && !moved(from.left, to.left) && !moved(from.top, to.top)) {
      continue;
    }

    const size = (rect: DOMRect): Keyframe =>
      resized
        ? {
            height: `${rect.height}px`,
            minHeight: `${rect.height}px`,
            width: `${rect.width}px`,
          }
        : {};

    const animation = node.animate(
      [
        {
          transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)`,
          ...size(from),
        },
        { transform: "translate(0px, 0px)", ...size(to) },
      ],
      FLIP_TIMING,
    );
    animation.id = FLIP_ID;
  }
};
