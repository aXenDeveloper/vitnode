import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { cn } from "cn";
import React from "react";

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max],
  );

  return (
    <SliderPrimitive.Root
      className={cn(
        "data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full",
        className,
      )}
      data-slot="slider"
      defaultValue={defaultValue}
      max={max}
      min={min}
      thumbAlignment="edge"
      value={value}
      {...props}
    >
      <SliderPrimitive.Control
        className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col"
        data-slot="slider-control"
      >
        <SliderPrimitive.Track
          className="bg-muted relative grow overflow-hidden rounded-full select-none data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
          data-slot="slider-track"
        >
          <SliderPrimitive.Indicator
            className="bg-primary select-none data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
            data-slot="slider-range"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            className="border-primary ring-ring/50 bg-background relative block size-4 shrink-0 rounded-full border shadow-sm transition-[color,box-shadow,scale] duration-150 ease-out select-none after:absolute after:-inset-3.5 hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden active:scale-110 data-disabled:pointer-events-none data-disabled:opacity-50 data-dragging:scale-110 data-dragging:ring-4 motion-reduce:transition-none"
            data-slot="slider-thumb"
            key={index}
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
