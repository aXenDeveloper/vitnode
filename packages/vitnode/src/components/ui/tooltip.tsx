import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cn } from "cn";
import React from "react";

function TooltipProvider({
  delay = 0,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  );
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 0,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: Pick<
  TooltipPrimitive.Positioner.Props,
  "align" | "alignOffset" | "side" | "sideOffset"
> &
  TooltipPrimitive.Popup.Props) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        className="isolate z-50"
        side={side}
        sideOffset={sideOffset}
      >
        <TooltipPrimitive.Popup
          className={cn(
            "bg-foreground text-background data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-md px-3 py-1.5 text-xs has-data-[slot=kbd]:pe-1.5 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm",
            className,
          )}
          data-slot="tooltip-content"
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="bg-foreground z-50 size-2.5 rotate-45 rounded-[2px] data-[side=bottom]:-top-[5px] data-[side=left]:-right-[5px] data-[side=right]:-left-[5px] data-[side=top]:-bottom-[5px]" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

function TooltipWithContent({
  children,
  text,
  ...props
}: Omit<React.ComponentProps<typeof TooltipContent>, "children"> & {
  children: React.ReactElement;
  text: React.ReactNode;
}) {
  const isInTooltipGroup = useIsInTooltipGroup();

  if (isInTooltipGroup && Object.keys(props).length === 0) {
    return <TooltipGroupTrigger content={text} render={children} />;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={children} />

        <TooltipContent {...props}>{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

type TooltipGroupHandle = TooltipPrimitive.Handle<React.ReactNode>;

const TooltipGroupContext = React.createContext<null | TooltipGroupHandle>(
  null,
);

const GLIDE =
  "duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-instant:transition-none motion-reduce:transition-none";

function TooltipGroup({
  children,
  side = "top",
  sideOffset = 8,
  align = "center",
}: Pick<TooltipPrimitive.Positioner.Props, "align" | "side" | "sideOffset"> & {
  children: React.ReactNode;
}) {
  const [handle] = React.useState(() =>
    TooltipPrimitive.createHandle<React.ReactNode>(),
  );

  return (
    <TooltipGroupContext value={handle}>
      {children}
      <TooltipPrimitive.Root handle={handle}>
        {({ payload }) => (
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Positioner
              align={align}
              className={cn(
                "isolate z-50 h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,left,right,bottom,transform]",
                GLIDE,
              )}
              side={side}
              sideOffset={sideOffset}
            >
              <TooltipPrimitive.Popup
                className={cn(
                  "bg-foreground text-background relative h-(--popup-height,auto) w-(--popup-width,auto) max-w-xs origin-(--transform-origin) rounded-md text-xs transition-[width,height,opacity,scale] data-ending-style:scale-90 data-ending-style:opacity-0 data-starting-style:scale-90 data-starting-style:opacity-0",
                  GLIDE,
                )}
                data-slot="tooltip-content"
              >
                <TooltipPrimitive.Viewport
                  className={cn(
                    "relative size-full overflow-clip px-3 py-1.5",
                    "**:data-current:w-[calc(var(--popup-width)-(--spacing(6)))] **:data-previous:w-[calc(var(--popup-width)-(--spacing(6)))]",
                    "**:data-current:transition-[translate,opacity] **:data-previous:transition-[translate,opacity]",
                    "**:data-current:duration-300 **:data-previous:duration-300 motion-reduce:**:data-current:transition-none motion-reduce:**:data-previous:transition-none",
                    "**:data-current:data-starting-style:opacity-0 data-[activation-direction~=left]:**:data-current:data-starting-style:-translate-x-1/2 data-[activation-direction~=right]:**:data-current:data-starting-style:translate-x-1/2",
                    "**:data-previous:data-ending-style:opacity-0 data-[activation-direction~=left]:**:data-previous:data-ending-style:translate-x-1/2 data-[activation-direction~=right]:**:data-previous:data-ending-style:-translate-x-1/2",
                  )}
                  data-slot="tooltip-viewport"
                >
                  {payload}
                </TooltipPrimitive.Viewport>
                <TooltipPrimitive.Arrow
                  className={cn(
                    "bg-foreground z-50 size-2.5 rotate-45 rounded-[2px] transition-[left,top] data-[side=bottom]:-top-1.25 data-[side=left]:-right-1.25 data-[side=right]:-left-1.25 data-[side=top]:-bottom-1.25",
                    GLIDE,
                  )}
                />
              </TooltipPrimitive.Popup>
            </TooltipPrimitive.Positioner>
          </TooltipPrimitive.Portal>
        )}
      </TooltipPrimitive.Root>
    </TooltipGroupContext>
  );
}

function useIsInTooltipGroup() {
  return React.use(TooltipGroupContext) !== null;
}

function TooltipGroupTrigger({
  content,
  ...props
}: Omit<TooltipPrimitive.Trigger.Props, "content" | "handle" | "payload"> & {
  content: React.ReactNode;
}) {
  const handle = React.use(TooltipGroupContext);

  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      handle={handle ?? undefined}
      payload={content}
      {...props}
    />
  );
}

export {
  Tooltip,
  TooltipContent,
  TooltipGroup,
  TooltipGroupTrigger,
  TooltipProvider,
  TooltipTrigger,
  TooltipWithContent,
  useIsInTooltipGroup,
};
