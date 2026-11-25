import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import React from "react";

import { MotionFeatures } from "@/components/motion-features";
import { toggleVariants } from "@/components/ui/toggle";

const INDICATOR_SPRING = { type: "spring", duration: 0.3, bounce: 0 } as const;

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    indicatorId?: string;
    orientation?: "horizontal" | "vertical";
    segmented?: boolean;
    spacing?: number;
  }
>({
  size: "default",
  variant: "default",
  spacing: 0,
  orientation: "horizontal",
});

const SEGMENTED_ITEM_SIZE = {
  default: "h-8 px-3",
  lg: "h-9 px-3.5",
  sm: "h-7 px-2.5",
} as const;

const SelectionIndicator = ({
  layoutId,
  segmented,
}: {
  layoutId: string;
  segmented: boolean;
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <m.span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 rounded-[inherit] ring-1",
        segmented
          ? "bg-background ring-foreground/10 dark:bg-input dark:ring-foreground/15 shadow-sm"
          : "bg-input/60 ring-foreground/10 dark:bg-input shadow-xs ring-inset",
      )}
      data-slot="toggle-group-indicator"
      layoutId={layoutId}
      transition={shouldReduceMotion ? { duration: 0 } : INDICATOR_SPRING}
    />
  );
};

/**
 * A set of {@link ToggleGroupItem}s. Single-select by default, with an
 * animated selection indicator; `multiple` allows several. `variant` and
 * `size` apply to every item; `spacing` is the gap in spacing units (`0`, the
 * default, joins the items into one control). A single-select group with no
 * spacing renders as a segmented control, matching `Tabs`: a muted track with
 * a raised pill on the selected item, whatever its `variant`.
 */
function ToggleGroup({
  className,
  variant,
  size,
  spacing = 0,
  orientation = "horizontal",
  multiple = false,
  children,
  ...props
}: ToggleGroupPrimitive.Props &
  VariantProps<typeof toggleVariants> & {
    orientation?: "horizontal" | "vertical";
    spacing?: number;
  }) {
  const indicatorId = React.useId();
  const segmented = !multiple && spacing === 0;
  const contextValue = React.useMemo(
    () => ({
      variant,
      size,
      spacing,
      orientation,
      segmented,
      indicatorId: multiple ? undefined : indicatorId,
    }),
    [variant, size, spacing, orientation, segmented, multiple, indicatorId],
  );
  const content = (
    <ToggleGroupContext.Provider value={contextValue}>
      {children}
    </ToggleGroupContext.Provider>
  );

  return (
    <ToggleGroupPrimitive
      className={cn(
        "group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] rounded-md data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
        segmented
          ? "bg-muted ring-foreground/5 gap-0.5 rounded-lg p-0.5 ring-1"
          : "data-[spacing=0]:data-[variant=outline]:shadow-xs",
        className,
      )}
      data-orientation={orientation}
      data-segmented={segmented ? "" : undefined}
      data-size={size}
      data-slot="toggle-group"
      data-spacing={spacing}
      data-variant={variant}
      multiple={multiple}
      style={{ "--gap": spacing } as React.CSSProperties}
      {...props}
    >
      {multiple ? (
        content
      ) : (
        <MotionFeatures withLayoutAndDrag>{content}</MotionFeatures>
      )}
    </ToggleGroupPrimitive>
  );
}

/**
 * One option in a {@link ToggleGroup}; the group's `variant` and `size` win
 * over its own.
 */
function ToggleGroupItem({
  className,
  children,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  const context = React.use(ToggleGroupContext);
  const { indicatorId, segmented = false } = context;
  const itemSize = context.size ?? size ?? "default";

  return (
    <TogglePrimitive
      className={cn(
        segmented
          ? cn(
              "relative isolate shrink-0 rounded-md focus:z-10 focus-visible:z-10",
              toggleVariants({ size: itemSize, variant: "default" }),
              SEGMENTED_ITEM_SIZE[itemSize],
              "text-muted-foreground hover:text-foreground aria-pressed:text-foreground hover:bg-transparent aria-pressed:bg-transparent aria-pressed:shadow-none dark:aria-pressed:bg-transparent",
            )
          : cn(
              "shrink-0 group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:px-2 group-data-[spacing=0]/toggle-group:shadow-none focus:z-10 focus-visible:z-10 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-end]:pe-1.5 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-start]:ps-1.5 group-data-[orientation=horizontal]/toggle-group:data-[spacing=0]:first:rounded-s-md group-data-[orientation=vertical]/toggle-group:data-[spacing=0]:first:rounded-t-md group-data-[orientation=horizontal]/toggle-group:data-[spacing=0]:last:rounded-e-md group-data-[orientation=vertical]/toggle-group:data-[spacing=0]:last:rounded-b-md group-data-[orientation=horizontal]/toggle-group:data-[spacing=0]:data-[variant=outline]:border-s-0 group-data-[orientation=vertical]/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-[orientation=horizontal]/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-s group-data-[orientation=vertical]/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t",
              toggleVariants({
                variant: context.variant ?? variant,
                size: context.size ?? size,
              }),
              indicatorId &&
                "text-muted-foreground hover:text-foreground aria-pressed:text-foreground relative isolate aria-pressed:bg-transparent aria-pressed:shadow-none dark:aria-pressed:bg-transparent",
            ),
        className,
      )}
      data-size={context.size ?? size}
      data-slot="toggle-group-item"
      data-spacing={context.spacing}
      data-variant={context.variant ?? variant}
      render={
        indicatorId
          ? ({ children: itemChildren, ...buttonProps }, { pressed }) => (
              <button {...buttonProps}>
                {pressed ? (
                  <SelectionIndicator
                    layoutId={indicatorId}
                    segmented={segmented}
                  />
                ) : null}
                {itemChildren}
              </button>
            )
          : undefined
      }
      {...props}
    >
      {children}
    </TogglePrimitive>
  );
}

export { ToggleGroup, ToggleGroupItem };
