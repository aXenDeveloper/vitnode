import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import React from "react";

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className,
      )}
      data-orientation={orientation}
      data-slot="tabs"
      orientation={orientation}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "group/tabs-list relative inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsIndicator({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Indicator>) {
  return (
    <TabsPrimitive.Indicator
      className={cn(
        "pointer-events-none absolute top-0 left-0 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) translate-y-(--active-tab-top) rounded-md",
        "transition-[translate,width,height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        "group-data-[variant=default]/tabs-list:bg-background dark:group-data-[variant=default]/tabs-list:border-input dark:group-data-[variant=default]/tabs-list:bg-input/30 group-data-[variant=default]/tabs-list:border group-data-[variant=default]/tabs-list:border-transparent group-data-[variant=default]/tabs-list:shadow-sm",
        "after:bg-foreground after:absolute after:opacity-0 group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-end-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:after:opacity-100",
        className,
      )}
      data-slot="tabs-indicator"
      renderBeforeHydration
      {...props}
    />
  );
}

function TabsList({
  children,
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      className={cn(tabsListVariants({ variant }), className)}
      data-slot="tabs-list"
      data-variant={variant}
      {...props}
    >
      <TabsIndicator />
      {children}
    </TabsPrimitive.List>
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Tab>) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        "text-foreground/60 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:text-muted-foreground dark:hover:text-foreground relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-colors group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "data-active:text-foreground dark:data-active:text-foreground",
        className,
      )}
      data-slot="tabs-trigger"
      {...props}
    />
  );
}

function TabsPanels({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState<{
    height: number;
    isSwitchingTab: boolean;
  }>();

  React.useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    let activePanel = content.querySelector(
      '[data-slot="tabs-content"]:not([hidden])',
    );

    const observer = new ResizeObserver(() => {
      const panel = content.querySelector(
        '[data-slot="tabs-content"]:not([hidden])',
      );
      const isSwitchingTab =
        panel !== activePanel ||
        !!content.querySelector(
          '[data-slot="tabs-content"][data-starting-style],[data-slot="tabs-content"][data-ending-style]',
        );
      activePanel = panel;

      setSize({
        height: content.getBoundingClientRect().height,
        isSwitchingTab,
      });
    });
    observer.observe(content);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      className={cn(
        "-m-2 box-content overflow-hidden p-2 transition-[height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        className,
      )}
      data-slot="tabs-panels"
      style={{
        height: size?.height,
        transitionDuration: size?.isSwitchingTab ? undefined : "0s",
      }}
      {...props}
    >
      <div className="relative" ref={contentRef}>
        {children}
      </div>
    </div>
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Panel>) {
  return (
    <TabsPrimitive.Panel
      className={cn(
        "flex-1 text-sm outline-none",
        "transition-[opacity,translate] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        "data-ending-style:absolute data-ending-style:inset-x-0 data-ending-style:top-0",
        "data-ending-style:opacity-0 data-starting-style:opacity-0",
        "data-ending-style:data-[activation-direction=right]:-translate-x-[110%] data-starting-style:data-[activation-direction=right]:translate-x-[110%]",
        "data-ending-style:data-[activation-direction=left]:translate-x-[110%] data-starting-style:data-[activation-direction=left]:-translate-x-[110%]",
        "data-ending-style:data-[activation-direction=down]:-translate-y-[110%] data-starting-style:data-[activation-direction=down]:translate-y-[110%]",
        "data-ending-style:data-[activation-direction=up]:translate-y-[110%] data-starting-style:data-[activation-direction=up]:-translate-y-[110%]",
        className,
      )}
      data-slot="tabs-content"
      {...props}
    />
  );
}

export {
  Tabs,
  TabsContent,
  TabsIndicator,
  TabsList,
  tabsListVariants,
  TabsPanels,
  TabsTrigger,
};
