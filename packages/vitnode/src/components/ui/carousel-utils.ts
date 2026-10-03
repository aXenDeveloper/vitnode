const EDITABLE_TARGET =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

const STEPS_BY_ORIENTATION = {
  horizontal: { ArrowLeft: -1, ArrowRight: 1 },
  vertical: { ArrowDown: 1, ArrowUp: -1 },
} as const satisfies Record<string, Record<string, -1 | 1>>;

const opposite = (step: -1 | 1): -1 | 1 => (step === 1 ? -1 : 1);

export const isEditableTarget = (target: EventTarget | null) =>
  target instanceof Element && target.closest(EDITABLE_TARGET) !== null;

export const carouselStepFromKey = ({
  isRtl,
  key,
  orientation,
}: {
  isRtl: boolean;
  key: string;
  orientation: "horizontal" | "vertical";
}): -1 | 1 | null => {
  const steps: Partial<Record<string, -1 | 1>> =
    STEPS_BY_ORIENTATION[orientation];
  const step = steps[key];
  if (step === undefined) return null;

  return orientation === "horizontal" && isRtl ? opposite(step) : step;
};

export const isRtlElement = (element: Element) =>
  element.closest("[dir]")?.getAttribute("dir") === "rtl";
