const FLIP_ID = "dnd-layout-flip";

const FLIP_TIMING: KeyframeAnimationOptions = {
  duration: 220,
  easing: "cubic-bezier(0.23, 1, 0.32, 1)",
};

export type LayoutSnapshot = ReadonlyMap<string, DOMRect>;

export interface LayoutFlipTarget {
  keyOf: (node: HTMLElement) => string | undefined;
  selector: string;
}

const nodesIn = (root: HTMLElement, { selector }: LayoutFlipTarget) => [
  ...root.querySelectorAll<HTMLElement>(selector),
];

const moved = (from: number, to: number): boolean => Math.abs(from - to) > 0.5;

export const snapshotLayout = (
  root: HTMLElement | null,
  target: LayoutFlipTarget,
): LayoutSnapshot | null =>
  root === null
    ? null
    : new Map(
        nodesIn(root, target).map(node => [
          target.keyOf(node) ?? "",
          node.getBoundingClientRect(),
        ]),
      );

export const playLayoutFlip = (
  root: HTMLElement | null,
  before: LayoutSnapshot | null,
  target: LayoutFlipTarget,
): void => {
  if (root === null || before === null) return;

  for (const node of nodesIn(root, target)) {
    const from = before.get(target.keyOf(node) ?? "");
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
