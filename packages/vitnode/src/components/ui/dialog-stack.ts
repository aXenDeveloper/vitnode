import React from "react";

interface DialogStackBounds {
  depth: number;
  top: number;
}

type ReportNestedBounds = (bounds: DialogStackBounds | null) => void;

type DialogStackStyle = React.CSSProperties &
  Record<`--dialog-stack-${string}`, string>;

const STACK_PEEK_PX = 16;
const STACK_SCALE_STEP = 0.05;

const TABBABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

const resolveInitialFocus = (popup: HTMLElement | null) => {
  if (!popup || popup.scrollHeight <= popup.clientHeight) {
    return true;
  }

  const firstTabbable = popup.querySelector<HTMLElement>(TABBABLE_SELECTOR);
  if (!firstTabbable) {
    return true;
  }

  const popupTop = popup.getBoundingClientRect().top;
  const tabbableBottom = firstTabbable.getBoundingClientRect().bottom;

  return tabbableBottom - popupTop <= popup.clientHeight ? true : popup;
};

export const DialogStackContext =
  React.createContext<null | ReportNestedBounds>(null);

const resolveStack = (
  height: number,
  nested: DialogStackBounds | null,
): {
  bounds: DialogStackBounds | null;
  style: DialogStackStyle | undefined;
} => {
  if (!height) {
    return { bounds: null, style: undefined };
  }

  if (!nested) {
    return { bounds: { top: -height / 2, depth: 0 }, style: undefined };
  }

  const depth = nested.depth + 1;
  const scale = 1 - STACK_SCALE_STEP * depth;
  const top = Math.min((-height * scale) / 2, nested.top - STACK_PEEK_PX);

  return {
    bounds: { top, depth },
    style: {
      "--dialog-stack-offset": `${top + (height * scale) / 2}px`,
      "--dialog-stack-scale": `${scale}`,
    },
  };
};

/**
 * Stacks a dialog popup behind the dialog opened from inside it: the parent
 * keeps its own size but shrinks a little, and moves up just enough to peek
 * out above the child when it would otherwise hide behind it. Browser-only
 * measurement through a `ResizeObserver`; the CSS lives in
 * `dialogStackClassName`.
 */
export const useDialogStack = () => {
  const reportToParent = React.use(DialogStackContext);
  const [height, setHeight] = React.useState(0);
  const [nested, setNested] = React.useState<DialogStackBounds | null>(null);
  const popupNodeRef = React.useRef<HTMLElement | null>(null);

  const observePopup = React.useCallback((node: HTMLElement | null) => {
    popupNodeRef.current = node;
    if (!node) {
      return;
    }

    const observer = new ResizeObserver(() => {
      setHeight(node.offsetHeight);
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
      setHeight(0);
    };
  }, []);

  const { bounds, style } = React.useMemo(
    () => resolveStack(height, nested),
    [height, nested],
  );

  React.useEffect(() => {
    reportToParent?.(bounds);
  }, [reportToParent, bounds]);

  React.useEffect(() => {
    if (!reportToParent) {
      return;
    }

    return () => {
      reportToParent(null);
    };
  }, [reportToParent]);

  const initialFocus = React.useCallback(
    () => resolveInitialFocus(popupNodeRef.current),
    [],
  );

  return { initialFocus, observePopup, reportNested: setNested, style };
};
