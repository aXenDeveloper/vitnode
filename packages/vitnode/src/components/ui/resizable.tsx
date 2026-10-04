import { cn } from "cn";
import * as ResizablePrimitive from "react-resizable-panels";

function ResizablePanelGroup({
  className,
  ...props
}: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      className={cn(
        "flex h-full w-full aria-[orientation=vertical]:flex-col",
        className,
      )}
      data-slot="resizable-panel-group"
      {...props}
    />
  );
}

function ResizablePanel({ ...props }: ResizablePrimitive.PanelProps) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: ResizablePrimitive.SeparatorProps & {
  withHandle?: boolean;
}) {
  return (
    <ResizablePrimitive.Separator
      className={cn(
        "group/resizable-handle bg-border ring-offset-background focus-visible:ring-ring data-[separator=hover]:bg-ring/50 data-[separator=active]:bg-primary ease-fluid relative flex w-px items-center justify-center transition-colors duration-150 after:absolute after:inset-y-0 after:start-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:start-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 rtl:after:translate-x-1/2 rtl:aria-[orientation=horizontal]:after:-translate-x-0 [&[aria-orientation=horizontal]>div]:rotate-90",
        className,
      )}
      data-slot="resizable-handle"
      {...props}
    >
      {withHandle && (
        <div className="bg-border group-data-[separator=active]/resizable-handle:bg-primary group-data-[separator=hover]/resizable-handle:bg-ring ease-fluid z-10 flex h-6 w-1 shrink-0 rounded-lg transition-[background-color,scale] duration-150 group-data-[separator=active]/resizable-handle:scale-125 motion-reduce:transition-colors" />
      )}
    </ResizablePrimitive.Separator>
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
