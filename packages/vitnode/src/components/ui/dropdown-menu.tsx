import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cn } from "cn";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import React from "react";

function DropdownMenu({
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Root>) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Portal>) {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Trigger>) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
  className,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  anchor,
  ...props
}: Pick<
  React.ComponentProps<typeof MenuPrimitive.Positioner>,
  "align" | "alignOffset" | "anchor" | "side" | "sideOffset"
> &
  React.ComponentProps<typeof MenuPrimitive.Popup>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="isolate z-50"
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          className={cn(
            "bg-popover text-popover-foreground ring-foreground/10 ease-fluid z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto overscroll-contain rounded-lg p-1 shadow-lg ring-1 transition-[opacity,scale] duration-150 outline-none data-closed:overflow-hidden data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:duration-100 data-instant:transition-none data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none",
            className,
          )}
          data-slot="dropdown-menu-content"
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Group>) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Item> & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <MenuPrimitive.Item
      className={cn(
        "group/dropdown-menu-item data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive/10 data-[variant=destructive]:data-highlighted:text-destructive dark:data-[variant=destructive]:data-highlighted:bg-destructive/20 data-[variant=destructive]:*:[svg]:text-destructive relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-inset:ps-8 pointer-coarse:py-2.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-inset={inset}
      data-slot="dropdown-menu-item"
      data-variant={variant}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.CheckboxItem> & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.CheckboxItem
      checked={checked}
      className={cn(
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:**:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 ps-8 pe-2 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 pointer-coarse:py-2.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-inset={inset}
      data-slot="dropdown-menu-checkbox-item"
      {...props}
    >
      <span
        className="pointer-events-none absolute start-2 flex size-4 items-center justify-center"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        <MenuPrimitive.CheckboxItemIndicator>
          <CheckIcon />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof MenuPrimitive.RadioGroup>) {
  return (
    <MenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  );
}

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.RadioItem> & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.RadioItem
      className={cn(
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:**:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 ps-8 pe-2 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 pointer-coarse:py-2.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-inset={inset}
      data-slot="dropdown-menu-radio-item"
      {...props}
    >
      <span
        className="pointer-events-none absolute start-2 flex size-4 items-center justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <MenuPrimitive.RadioItemIndicator>
          <CheckIcon />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<"div"> & {
  inset?: boolean;
}) {
  return (
    <div
      className={cn(
        "text-muted-foreground px-2 py-1.5 text-xs font-medium data-inset:ps-8",
        className,
      )}
      data-inset={inset}
      data-slot="dropdown-menu-label"
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      data-slot="dropdown-menu-separator"
      {...props}
    />
  );
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-muted-foreground group-data-highlighted/dropdown-menu-item:text-accent-foreground ms-auto text-xs tracking-widest",
        className,
      )}
      data-slot="dropdown-menu-shortcut"
      {...props}
    />
  );
}

function DropdownMenuSub({
  ...props
}: React.ComponentProps<typeof MenuPrimitive.SubmenuRoot>) {
  return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />;
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.SubmenuTrigger> & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.SubmenuTrigger
      className={cn(
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:**:text-accent-foreground data-popup-open:bg-accent data-popup-open:text-accent-foreground data-popup-open:**:text-accent-foreground flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-inset:ps-8 pointer-coarse:py-2.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-inset={inset}
      data-slot="dropdown-menu-sub-trigger"
      {...props}
    >
      {children}
      <ChevronRightIcon className="ms-auto rtl:rotate-180" />
    </MenuPrimitive.SubmenuTrigger>
  );
}

function DropdownMenuSubContent({
  className,
  side = "right",
  sideOffset = 0,
  align = "start",
  alignOffset = -4,
  anchor,
  ...props
}: Pick<
  React.ComponentProps<typeof MenuPrimitive.Positioner>,
  "align" | "alignOffset" | "anchor" | "side" | "sideOffset"
> &
  React.ComponentProps<typeof MenuPrimitive.Popup>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="isolate z-50"
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          className={cn(
            "bg-popover text-popover-foreground ring-foreground/10 ease-fluid z-50 max-h-(--available-height) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto overscroll-contain rounded-lg p-1 shadow-lg ring-1 transition-[opacity,scale] duration-150 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:duration-100 data-instant:transition-none data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none",
            className,
          )}
          data-slot="dropdown-menu-sub-content"
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
