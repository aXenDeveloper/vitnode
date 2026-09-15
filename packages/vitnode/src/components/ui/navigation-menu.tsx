import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import { ChevronDownIcon } from "lucide-react";
import React from "react";

function NavigationMenu({
  className,
  children,
  align = "start",
  ...props
}: NavigationMenuPrimitive.Root.Props &
  Pick<NavigationMenuPrimitive.Positioner.Props, "align">) {
  return (
    <NavigationMenuPrimitive.Root
      className={cn(
        "group/navigation-menu relative flex max-w-max flex-1 items-center justify-center",
        className,
      )}
      data-slot="navigation-menu"
      {...props}
    >
      {children}
      <NavigationMenuPositioner align={align} />
    </NavigationMenuPrimitive.Root>
  );
}

const HIGHLIGHT_SELECTOR =
  '[data-slot="navigation-menu-trigger"], [data-slot="navigation-menu-link"]';
const OPEN_TRIGGER_SELECTOR =
  '[data-slot="navigation-menu-trigger"][data-popup-open]';
const ACTIVE_LINK_SELECTOR =
  '[data-slot="navigation-menu-link"][data-active]:not([data-slot="navigation-menu-content"] *)';

function NavigationMenuList({
  className,
  children,
  onFocus,
  onPointerLeave,
  onPointerOver,
  ref,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.List>) {
  const listRef = React.useRef<HTMLUListElement | null>(null);
  const highlightRef = React.useRef<HTMLSpanElement>(null);
  const pointerInsideRef = React.useRef(false);

  const moveHighlightTo = React.useCallback((item: HTMLElement) => {
    const list = listRef.current;
    const highlight = highlightRef.current;
    if (!list || !highlight) return;

    const listBox = list.getBoundingClientRect();
    const itemBox = item.getBoundingClientRect();
    const wasVisible = highlight.dataset.visible !== undefined;

    if (!wasVisible) highlight.dataset.instant = "";

    highlight.style.height = `${itemBox.height.toString()}px`;
    highlight.style.top = `${(itemBox.top - listBox.top).toString()}px`;
    highlight.style.translate = `${(itemBox.left - listBox.left).toString()}px`;
    highlight.style.width = `${itemBox.width.toString()}px`;

    if (!wasVisible) {
      highlight.getBoundingClientRect();
      delete highlight.dataset.instant;
    }

    highlight.dataset.visible = "";
  }, []);

  const hideHighlight = React.useCallback(() => {
    const highlight = highlightRef.current;
    if (highlight) delete highlight.dataset.visible;
  }, []);

  const itemUnder = (target: EventTarget | null) => {
    const list = listRef.current;
    if (!list || !(target instanceof Element)) return null;

    const item = target.closest<HTMLElement>(HIGHLIGHT_SELECTOR);

    return item && list.contains(item) ? item : null;
  };

  const settleHighlight = React.useCallback(() => {
    const list = listRef.current;
    const resting =
      list?.querySelector<HTMLElement>(OPEN_TRIGGER_SELECTOR) ??
      list?.querySelector<HTMLElement>(ACTIVE_LINK_SELECTOR);

    if (resting) {
      moveHighlightTo(resting);

      return;
    }

    hideHighlight();
  }, [hideHighlight, moveHighlightTo]);

  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const settleWhenIdle = () => {
      if (!pointerInsideRef.current) settleHighlight();
    };

    const attributes = new MutationObserver(settleWhenIdle);
    attributes.observe(list, {
      attributeFilter: ["data-active", "data-popup-open"],
      attributes: true,
      subtree: true,
    });

    const resize = new ResizeObserver(settleWhenIdle);
    resize.observe(list);

    return () => {
      attributes.disconnect();
      resize.disconnect();
    };
  }, [settleHighlight]);

  return (
    <NavigationMenuPrimitive.List
      className={cn(
        "group relative flex flex-1 list-none items-center justify-center gap-(--navigation-menu-gap) [--navigation-menu-gap:--spacing(1)]",
        className,
      )}
      data-slot="navigation-menu-list"
      onFocus={event => {
        const item = itemUnder(event.target);
        if (item) moveHighlightTo(item);
        onFocus?.(event);
      }}
      onPointerLeave={event => {
        pointerInsideRef.current = false;
        settleHighlight();
        onPointerLeave?.(event);
      }}
      onPointerOver={event => {
        pointerInsideRef.current = true;
        const item = itemUnder(event.target);
        if (item) moveHighlightTo(item);
        onPointerOver?.(event);
      }}
      ref={node => {
        listRef.current = node;
        if (typeof ref === "function") return ref(node);
        if (ref) ref.current = node;
      }}
      {...props}
    >
      <span
        aria-hidden
        className="bg-muted pointer-events-none absolute top-0 left-0 rounded-md opacity-0 transition-[translate,width,height,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-instant:transition-none data-visible:opacity-100 motion-reduce:transition-none"
        data-slot="navigation-menu-highlight"
        ref={highlightRef}
      />
      {children}
    </NavigationMenuPrimitive.List>
  );
}

function NavigationMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Item>) {
  return (
    <NavigationMenuPrimitive.Item
      className={cn("relative", className)}
      data-slot="navigation-menu-item"
      {...props}
    />
  );
}

const navigationMenuTriggerStyle = cva(
  "group/navigation-menu-trigger relative inline-flex h-9 w-max items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-popup-open:after:absolute data-popup-open:after:inset-y-0 data-popup-open:after:-inset-x-(--navigation-menu-gap) data-popup-open:after:content-['']",
);

function NavigationMenuTrigger({
  className,
  children,
  ...props
}: NavigationMenuPrimitive.Trigger.Props) {
  return (
    <NavigationMenuPrimitive.Trigger
      className={cn(navigationMenuTriggerStyle(), "group", className)}
      data-slot="navigation-menu-trigger"
      {...props}
    >
      {children}{" "}
      <ChevronDownIcon
        aria-hidden="true"
        className="relative top-px ms-1 size-3 shrink-0 transition duration-300 group-data-popup-open/navigation-menu-trigger:rotate-180"
      />
    </NavigationMenuPrimitive.Trigger>
  );
}

function NavigationMenuContent({
  className,
  keepMounted = true,
  ...props
}: NavigationMenuPrimitive.Content.Props) {
  return (
    <NavigationMenuPrimitive.Content
      className={cn(
        "h-full w-full p-2 transition-[opacity,transform,translate] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:data-[activation-direction=left]:translate-x-[50%] data-starting-style:data-[activation-direction=left]:translate-x-[-50%] data-ending-style:data-[activation-direction=right]:translate-x-[-50%] data-starting-style:data-[activation-direction=right]:translate-x-[50%] **:data-[slot=navigation-menu-link]:focus:ring-0 **:data-[slot=navigation-menu-link]:focus:outline-none motion-reduce:transition-none",
        className,
      )}
      data-slot="navigation-menu-content"
      keepMounted={keepMounted}
      {...props}
    />
  );
}

function NavigationMenuPositioner({
  className,
  side = "bottom",
  sideOffset = 8,
  align = "start",
  alignOffset = 0,
  collisionPadding = 16,
  ...props
}: NavigationMenuPrimitive.Positioner.Props) {
  return (
    <NavigationMenuPrimitive.Portal>
      <NavigationMenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        className={cn(
          "isolate z-50 h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,left,right,bottom] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-instant:transition-none",
          className,
        )}
        collisionPadding={collisionPadding}
        side={side}
        sideOffset={sideOffset}
        {...props}
      >
        <NavigationMenuPrimitive.Popup className="origin-top-center bg-popover text-popover-foreground ring-foreground/10 data-open:animate-in data-open:zoom-in-95 data-open:fade-in-0 data-closed:animate-out data-closed:zoom-out-95 data-closed:fade-out-0 relative h-(--popup-height) w-(--popup-width) origin-(--transform-origin) overflow-hidden rounded-lg shadow ring-1 transition-[width,height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none">
          <NavigationMenuPrimitive.Viewport className="relative size-full overflow-hidden" />
        </NavigationMenuPrimitive.Popup>
      </NavigationMenuPrimitive.Positioner>
    </NavigationMenuPrimitive.Portal>
  );
}

function NavigationMenuLink({
  className,
  ...props
}: NavigationMenuPrimitive.Link.Props) {
  return (
    <NavigationMenuPrimitive.Link
      className={cn(
        "focus-visible:ring-ring/50 in-data-[slot=navigation-menu-content]:hover:bg-muted in-data-[slot=navigation-menu-content]:focus:bg-muted in-data-[slot=navigation-menu-content]:data-active:bg-muted/50 relative flex items-center gap-2 rounded-md p-2 text-sm transition-all outline-none focus-visible:ring-3 focus-visible:outline-1 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-slot="navigation-menu-link"
      {...props}
    />
  );
}

function NavigationMenuIndicator({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Icon>) {
  return (
    <NavigationMenuPrimitive.Icon
      className={cn(
        "top-full z-1 flex h-1.5 items-end justify-center overflow-hidden",
        className,
      )}
      data-slot="navigation-menu-indicator"
      {...props}
    >
      <div className="bg-border relative top-[60%] h-2 w-2 rotate-45 rounded-ss-sm shadow-md" />
    </NavigationMenuPrimitive.Icon>
  );
}

export {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuPositioner,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
};
