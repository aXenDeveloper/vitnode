import { cn } from "cn";
import { GripVerticalIcon } from "lucide-react";
import { type MotionValue, useMotionValue, useTransform } from "motion/react";
import * as m from "motion/react-m";
import React from "react";
import { useTranslations } from "use-intl";

import { MotionFeatures } from "@/components/motion-features";

import {
  clampPosition,
  positionFromKey,
  positionFromPointer,
} from "./comparison-utils";

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
  const isDraggingRef = React.useRef(false);

  const moveTo = (next: number) => {
    position.set(next);
    setValueNow(next);
    onPositionChange?.(next);
  };

  const moveToPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    moveTo(
      positionFromPointer(
        event.clientX,
        event.currentTarget.getBoundingClientRect(),
      ),
    );
  };

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
            "focus-visible:ring-ring/50 relative isolate w-full touch-pan-y overflow-hidden outline-none select-none focus-visible:ring-3",
            mode === "drag" && "cursor-ew-resize",
            className,
          )}
          data-slot="comparison"
          onKeyDown={event => {
            const next = positionFromKey(
              event.key,
              position.get(),
              event.shiftKey,
            );
            if (next === null) return;

            event.preventDefault();
            moveTo(next);
          }}
          onPointerCancel={() => {
            isDraggingRef.current = false;
          }}
          onPointerDown={event => {
            if (mode !== "drag") return;

            isDraggingRef.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            moveToPointer(event);
          }}
          onPointerMove={event => {
            if (mode === "hover" || isDraggingRef.current) moveToPointer(event);
          }}
          onPointerUp={() => {
            isDraggingRef.current = false;
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
  const left = useTransform(position, value => `${value}%`);

  return (
    <m.div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-0 z-10 flex h-full w-10 -translate-x-1/2 items-center justify-center",
        className,
      )}
      data-slot="comparison-handle"
      style={{ left }}
      {...props}
    >
      {children ?? (
        <>
          <div className="bg-foreground/70 absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 shadow-sm" />
          {mode === "drag" && (
            <div className="bg-background text-foreground ring-foreground/20 relative flex items-center justify-center rounded-md px-0.5 py-1 shadow-sm ring-1">
              <GripVerticalIcon className="size-4" />
            </div>
          )}
        </>
      )}
    </m.div>
  );
}

export { Comparison, ComparisonHandle, ComparisonItem };
