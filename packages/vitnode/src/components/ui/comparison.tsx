import { cn } from "cn";
import { GripVerticalIcon } from "lucide-react";
import {
  animate,
  type MotionValue,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import * as m from "motion/react-m";
import React from "react";
import { useTranslations } from "use-intl";

import { MotionFeatures } from "@/components/motion-features";

import {
  clampPosition,
  positionFromKey,
  positionFromPointer,
} from "./comparison-utils";

const GLIDE_TRANSITION = { type: "spring", duration: 0.25, bounce: 0 } as const;

const ComparisonContext = React.createContext<null | {
  mode: "drag" | "hover";
  position: MotionValue<number>;
}>(null);

const useComparison = () => {
  const context = React.use(ComparisonContext);

  if (!context) {
    throw new Error("Comparison parts must be used inside <Comparison>");
  }

  return context;
};

function Comparison({
  "aria-label": ariaLabel,
  className,
  defaultPosition = 50,
  mode = "drag",
  onPositionChange,
  ...props
}: Omit<React.ComponentProps<"div">, "defaultValue"> & {
  defaultPosition?: number;
  mode?: "drag" | "hover";
  onPositionChange?: (position: number) => void;
}) {
  const t = useTranslations("core.global");
  const position = useMotionValue(clampPosition(defaultPosition));
  const [valueNow, setValueNow] = React.useState(() => position.get());
  const [isDragging, setIsDragging] = React.useState(false);
  const shouldReduceMotion = useReducedMotion();

  const commit = (next: number) => {
    setValueNow(next);
    onPositionChange?.(next);
  };

  const glideTo = (next: number) => {
    animate(
      position,
      next,
      shouldReduceMotion ? { duration: 0 } : GLIDE_TRANSITION,
    );
    commit(next);
  };

  const followTo = (next: number) => {
    position.stop();
    position.set(next);
    commit(next);
  };

  const pointerPosition = (event: React.PointerEvent<HTMLDivElement>) =>
    positionFromPointer(
      event.clientX,
      event.currentTarget.getBoundingClientRect(),
    );

  const contextValue = React.useMemo(
    () => ({ mode, position }),
    [mode, position],
  );
  const rounded = Math.round(valueNow);

  return (
    <MotionFeatures>
      <ComparisonContext value={contextValue}>
        <div
          aria-label={ariaLabel ?? t("comparison_slider")}
          aria-orientation="horizontal"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={rounded}
          aria-valuetext={`${rounded}%`}
          className={cn(
            "group/comparison focus-visible:ring-ring/50 relative isolate w-full touch-pan-y overflow-hidden outline-none select-none focus-visible:ring-3",
            mode === "drag" && "cursor-ew-resize",
            className,
          )}
          data-dragging={isDragging || undefined}
          data-slot="comparison"
          onKeyDown={event => {
            const next = positionFromKey(
              event.key,
              position.get(),
              event.shiftKey,
            );
            if (next === null) return;

            event.preventDefault();
            glideTo(next);
          }}
          onPointerCancel={() => {
            setIsDragging(false);
          }}
          onPointerDown={event => {
            if (mode !== "drag") return;

            setIsDragging(true);
            event.currentTarget.setPointerCapture(event.pointerId);
            glideTo(pointerPosition(event));
          }}
          onPointerMove={event => {
            if (mode === "hover" || isDragging) {
              followTo(pointerPosition(event));
            }
          }}
          onPointerUp={() => {
            setIsDragging(false);
          }}
          role="slider"
          tabIndex={0}
          {...props}
        />
      </ComparisonContext>
    </MotionFeatures>
  );
}

function ComparisonItem({
  className,
  position: side,
  ...props
}: React.ComponentProps<typeof m.div> & {
  position: "left" | "right";
}) {
  const { position } = useComparison();
  const clipPath = useTransform(position, value =>
    side === "left" ? `inset(0 ${100 - value}% 0 0)` : `inset(0 0 0 ${value}%)`,
  );

  return (
    <m.div
      aria-hidden="true"
      className={cn(
        "absolute inset-0 size-full *:size-full *:object-cover",
        className,
      )}
      data-slot="comparison-item"
      style={{ clipPath }}
      {...props}
    />
  );
}

function ComparisonHandle({
  children,
  className,
  ...props
}: React.ComponentProps<typeof m.div>) {
  const { mode, position } = useComparison();
  const x = useTransform(position, value => `${value}%`);

  return (
    <m.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10"
      style={{ x }}
    >
      <m.div
        className={cn(
          "absolute inset-y-0 left-0 flex w-10 -translate-x-1/2 items-center justify-center",
          className,
        )}
        data-slot="comparison-handle"
        {...props}
      >
        {children ?? (
          <>
            <div className="bg-foreground/70 absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 shadow-sm" />
            {mode === "drag" && (
              <div className="bg-background text-foreground ring-foreground/20 ease-fluid relative flex items-center justify-center rounded-md px-0.5 py-1 shadow-sm ring-1 transition-[scale,box-shadow] duration-150 group-data-dragging/comparison:scale-110 group-data-dragging/comparison:shadow-md motion-reduce:transition-none">
                <GripVerticalIcon className="size-4" />
              </div>
            )}
          </>
        )}
      </m.div>
    </m.div>
  );
}

export { Comparison, ComparisonHandle, ComparisonItem };
