import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { cn } from "cn";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  useIsPresent,
} from "motion/react";
import * as m from "motion/react-m";
import React from "react";
import { useTranslations } from "use-intl";

import { MotionFeatures } from "@/components/motion-features";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

/** Base UI's combobox root: a text input that filters a list of options. */
const Combobox = ComboboxPrimitive.Root;

function ComboboxValue({ ...props }: ComboboxPrimitive.Value.Props) {
  return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />;
}

function ComboboxTrigger({
  className,
  children,
  ...props
}: ComboboxPrimitive.Trigger.Props) {
  return (
    <ComboboxPrimitive.Trigger
      className={cn(
        "group/combobox-trigger [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-slot="combobox-trigger"
      {...props}
    >
      {children}
      <ChevronDownIcon className="text-muted-foreground ease-fluid pointer-events-none size-4 transition-transform duration-200 group-data-popup-open/combobox-trigger:rotate-180 motion-reduce:transition-none" />
    </ComboboxPrimitive.Trigger>
  );
}

function ComboboxClear({ className, ...props }: ComboboxPrimitive.Clear.Props) {
  return (
    <ComboboxPrimitive.Clear
      className={cn(className)}
      data-slot="combobox-clear"
      render={<InputGroupButton size="icon-xs" variant="ghost" />}
      {...props}
    >
      <XIcon className="pointer-events-none" />
    </ComboboxPrimitive.Clear>
  );
}

/**
 * The combobox's text input inside an input group. `showTrigger` (default
 * `true`) adds a button that opens the list; `showClear` (default `false`) adds
 * a clear button, which takes the trigger's place while there is a value.
 */
function ComboboxInput({
  className,
  children,
  disabled = false,
  showTrigger = true,
  showClear = false,
  ...props
}: ComboboxPrimitive.Input.Props & {
  showClear?: boolean;
  showTrigger?: boolean;
}) {
  return (
    <InputGroup className={cn("w-full", className)}>
      <ComboboxPrimitive.Input
        render={<InputGroupInput disabled={disabled} />}
        {...props}
      />
      <InputGroupAddon align="inline-end">
        {showTrigger && (
          <InputGroupButton
            className="group-has-data-[slot=combobox-clear]/input-group:hidden data-pressed:bg-transparent"
            data-slot="input-group-button"
            disabled={disabled}
            render={<ComboboxTrigger />}
            size="icon-xs"
            variant="ghost"
          />
        )}
        {showClear && <ComboboxClear disabled={disabled} />}
      </InputGroupAddon>
      {children}
    </InputGroup>
  );
}

/**
 * The popup holding the option list, rendered in a portal; opens below and
 * aligned to the start of the input by default.
 */
function ComboboxContent({
  className,
  children,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  alignOffset = 0,
  anchor,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<
    ComboboxPrimitive.Positioner.Props,
    "align" | "alignOffset" | "anchor" | "side" | "sideOffset"
  >) {
  const layoutGroupId = React.useId();

  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="isolate z-50"
        side={side}
        sideOffset={sideOffset}
      >
        <ComboboxPrimitive.Popup
          className={cn(
            "group/combobox-content bg-popover/90 text-popover-foreground ring-foreground/10 *:data-[slot=input-group]:border-input/30 *:data-[slot=input-group]:bg-input/30 ease-fluid relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-[calc(var(--anchor-width)+--spacing(7))] origin-(--transform-origin) overflow-hidden rounded-lg shadow-lg ring-1 backdrop-blur-sm transition-[opacity,scale,translate] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:duration-100 data-starting-style:scale-95 data-starting-style:opacity-0 data-[chips=true]:min-w-(--anchor-width) data-[side=bottom]:data-starting-style:-translate-y-1.5 data-[side=top]:data-starting-style:translate-y-1.5 *:data-[slot=input-group]:m-1 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:h-8 *:data-[slot=input-group]:shadow-none motion-reduce:transition-none",
            className,
          )}
          data-chips={!!anchor}
          data-slot="combobox-content"
          {...props}
        >
          <MotionFeatures withLayoutAndDrag>
            <MotionConfig reducedMotion="user">
              <LayoutGroup id={layoutGroupId}>{children}</LayoutGroup>
            </MotionConfig>
          </MotionFeatures>
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

/** The scrolling list of options. */
function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      className={cn(
        "no-scrollbar max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--available-height)---spacing(9)))] scroll-py-1 overflow-y-auto overscroll-contain p-1 data-empty:p-0",
        className,
      )}
      data-slot="combobox-list"
      render={<m.div layoutScroll />}
      {...props}
    />
  );
}

const HIGHLIGHT_TRANSITION = {
  type: "spring",
  stiffness: 560,
  damping: 40,
  mass: 0.5,
} as const;

const renderComboboxItem = (
  props: React.ComponentProps<"div">,
  state: ComboboxPrimitive.Item.State,
) => (
  <div {...props}>
    {state.highlighted && (
      <m.span
        aria-hidden="true"
        className="bg-foreground/5 pointer-events-none absolute inset-0 -z-10 rounded-md"
        data-slot="combobox-item-highlight"
        layoutId="combobox-item-highlight"
        transition={HIGHLIGHT_TRANSITION}
      />
    )}
    {props.children}
  </div>
);

/**
 * One option, with a check mark while selected. The highlight glides between
 * options as the pointer or the arrow keys move it.
 */
function ComboboxItem({
  className,
  children,
  ...props
}: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      className={cn(
        "text-muted-foreground data-highlighted:text-accent-foreground aria-selected:text-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground relative isolate flex w-full cursor-default items-center gap-2 rounded-md py-1.5 ps-2 pe-8 text-sm outline-hidden transition-colors duration-100 select-none data-disabled:pointer-events-none data-disabled:opacity-50 pointer-coarse:py-2.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-slot="combobox-item"
      render={renderComboboxItem}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator
        render={
          <span className="ease-fluid pointer-events-none absolute end-2 flex size-4 items-center justify-center transition-[opacity,scale] duration-100 data-ending-style:scale-80 data-ending-style:opacity-0 data-starting-style:scale-80 data-starting-style:opacity-0 motion-reduce:transition-none" />
        }
      >
        <CheckIcon className="pointer-events-none" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  );
}

function ComboboxGroup({ className, ...props }: ComboboxPrimitive.Group.Props) {
  return (
    <ComboboxPrimitive.Group
      className={cn(className)}
      data-slot="combobox-group"
      {...props}
    />
  );
}

function ComboboxLabel({
  className,
  ...props
}: ComboboxPrimitive.GroupLabel.Props) {
  return (
    <ComboboxPrimitive.GroupLabel
      className={cn(
        "text-muted-foreground px-2 pt-2 pb-1 text-xs font-medium tracking-wider uppercase",
        className,
      )}
      data-slot="combobox-label"
      {...props}
    />
  );
}

function ComboboxCollection({ ...props }: ComboboxPrimitive.Collection.Props) {
  return (
    <ComboboxPrimitive.Collection data-slot="combobox-collection" {...props} />
  );
}

/** Shown when no option matches the input. */
function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      className={cn(
        "text-muted-foreground hidden w-full justify-center py-2 text-center text-sm group-data-empty/combobox-content:flex",
        className,
      )}
      data-slot="combobox-empty"
      {...props}
    />
  );
}

function ComboboxSeparator({
  className,
  ...props
}: ComboboxPrimitive.Separator.Props) {
  return (
    <ComboboxPrimitive.Separator
      className={cn("bg-foreground/10 -mx-1 my-1 h-px", className)}
      data-slot="combobox-separator"
      {...props}
    />
  );
}

/**
 * The field holding the selected chips and the search input of a `multiple`
 * combobox. Pass it to `ComboboxContent` as the `anchor` so the list matches
 * its width. `showTrigger` (default `true`) adds a chevron that opens the list.
 */
function ComboboxChips({
  className,
  children,
  showTrigger = true,
  ...props
}: ComboboxPrimitive.Chips.Props &
  React.ComponentPropsWithRef<typeof ComboboxPrimitive.Chips> & {
    showTrigger?: boolean;
  }) {
  const t = useTranslations("core.global");

  return (
    <ComboboxPrimitive.Chips
      className={cn(
        "border-input focus-within:border-ring focus-within:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:border-destructive/50 dark:has-aria-invalid:ring-destructive/40 dark:bg-input/30 bg-card relative flex min-h-9 w-full items-start gap-1 rounded-md border bg-clip-padding py-1.5 ps-2.5 pe-1.5 text-sm shadow-xs transition-[color,box-shadow] focus-within:ring-3 has-aria-invalid:ring-3 has-data-[slot=combobox-chip]:py-1 has-data-[slot=combobox-chip]:ps-1",
        className,
      )}
      data-slot="combobox-chips"
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {children}
      </div>
      {showTrigger && (
        <ComboboxTrigger
          className="text-muted-foreground hover:text-foreground"
          render={
            <Button
              aria-label={t("select_options")}
              size="icon-xs"
              variant="ghost"
            />
          }
        />
      )}
    </ComboboxPrimitive.Chips>
  );
}

const CHIP_RADIUS = "round 0.375rem";
const CHIP_TRANSITION = {
  default: { type: "spring", stiffness: 620, damping: 34, mass: 0.5 },
  layout: HIGHLIGHT_TRANSITION,
  opacity: { duration: 0.12, ease: [0.16, 1, 0.3, 1] },
} as const;
const CHIP_INITIAL = {
  clipPath: `inset(0 0 0 0% ${CHIP_RADIUS})`,
  opacity: 0,
  scale: 0.92,
  y: 6,
};
const CHIP_VISIBLE = {
  clipPath: `inset(0 0 0 0% ${CHIP_RADIUS})`,
  opacity: 1,
  scale: 1,
  y: 0,
};
const CHIP_EXIT = {
  clipPath: `inset(0 0 0 100% ${CHIP_RADIUS})`,
  opacity: 0,
  transition: { duration: 0.12, ease: [0.16, 1, 0.3, 1] },
} as const;

const chipClassName =
  "bg-muted text-foreground flex h-6 w-fit max-w-full min-w-0 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium whitespace-nowrap has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50 has-data-[slot=combobox-chip-remove]:pe-0.5";

const chipRemoveClassName =
  "text-muted-foreground hover:bg-foreground/10 hover:text-foreground size-5 rounded-sm";

function ComboboxChipList({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence initial={false} mode="popLayout">
        {children}
      </AnimatePresence>
    </MotionConfig>
  );
}

const ComboboxChipMotion = ({
  children,
  ref,
}: {
  children: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}) => (
  <MotionFeatures withLayoutAndDrag>
    <m.div
      animate={CHIP_VISIBLE}
      className="flex min-w-0"
      data-slot="combobox-chip-motion"
      exit={CHIP_EXIT}
      initial={CHIP_INITIAL}
      layout="position"
      ref={ref}
      transition={CHIP_TRANSITION}
    >
      {children}
    </m.div>
  </MotionFeatures>
);

/**
 * One selected value inside `ComboboxChips`, wrapped in `ComboboxChipList` so
 * it springs in and wipes out. `showRemove` (default `true`) adds a remove
 * button, labelled with the chip's text when `children` is a string.
 */
function ComboboxChip({
  className,
  children,
  ref,
  showRemove = true,
  ...props
}: Omit<ComboboxPrimitive.Chip.Props, "ref"> & {
  ref?: React.Ref<HTMLDivElement>;
  showRemove?: boolean;
}) {
  const t = useTranslations("core.global");
  const isPresent = useIsPresent();
  const removeLabel =
    typeof children === "string"
      ? t("remove_named", { name: children })
      : t("remove");
  const label = <span className="min-w-0 truncate">{children}</span>;

  return (
    <ComboboxChipMotion ref={ref}>
      {isPresent ? (
        <ComboboxPrimitive.Chip
          className={cn(chipClassName, className)}
          data-slot="combobox-chip"
          {...props}
        >
          {label}
          {showRemove && (
            <ComboboxPrimitive.ChipRemove
              className={chipRemoveClassName}
              data-slot="combobox-chip-remove"
              render={
                <Button
                  aria-label={removeLabel}
                  size="icon-xs"
                  variant="ghost"
                />
              }
            >
              <XIcon className="pointer-events-none" />
            </ComboboxPrimitive.ChipRemove>
          )}
        </ComboboxPrimitive.Chip>
      ) : (
        <span
          aria-hidden="true"
          className={cn(chipClassName, "pointer-events-none", className)}
        >
          {label}
          {showRemove && (
            <span
              className={cn(
                chipRemoveClassName,
                "flex items-center justify-center",
              )}
              data-slot="combobox-chip-remove"
            >
              <XIcon className="size-3" />
            </span>
          )}
        </span>
      )}
    </ComboboxChipMotion>
  );
}

function ComboboxChipOverflow({
  count,
  ref,
}: {
  count: number;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const t = useTranslations("core.global");

  return (
    <ComboboxChipMotion ref={ref}>
      <span
        className={cn(chipClassName, "text-muted-foreground tabular-nums")}
        data-slot="combobox-chip-overflow"
      >
        {t("more_count", { count })}
      </span>
    </ComboboxChipMotion>
  );
}

function ComboboxChipsInput({
  className,
  ...props
}: ComboboxPrimitive.Input.Props) {
  return (
    <MotionFeatures withLayoutAndDrag>
      <ComboboxPrimitive.Input
        className={cn(
          "placeholder:text-muted-foreground h-6 min-w-16 flex-1 outline-none",
          className,
        )}
        data-slot="combobox-chip-input"
        render={<m.input layout="position" transition={HIGHLIGHT_TRANSITION} />}
        {...props}
      />
    </MotionFeatures>
  );
}

function useComboboxAnchor() {
  return React.useRef<HTMLDivElement | null>(null);
}

export {
  Combobox,
  ComboboxChip,
  ComboboxChipList,
  ComboboxChipOverflow,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
};
