import { Collapsible, CollapsibleContent } from "../../ui/collapsible";

const SPACING = {
  form: { offset: "-mt-8", padding: "pt-8" },
  tab: { offset: "-mt-6", padding: "pt-6" },
} as const;

/**
 * Opens and closes a conditional `AutoForm` field (one with `hidden`) with a
 * height animation. It cancels the parent's flex gap and carries it inside the
 * panel, so nothing jumps when the panel finishes closing. `spacing` matches the
 * parent: `form` for the form's `gap-8`, `tab` for a tab panel's `gap-6`.
 */
export const AutoFormFieldCollapse = ({
  children,
  open,
  spacing,
}: {
  children: React.ReactNode;
  open: boolean;
  spacing: keyof typeof SPACING;
}) => (
  <Collapsible className={SPACING[spacing].offset} open={open}>
    <CollapsibleContent className="ease-fluid -mx-1 h-(--collapsible-panel-height) overflow-hidden px-1 transition-[height,opacity] duration-200 data-ending-style:h-0 data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none">
      <div className={SPACING[spacing].padding}>{children}</div>
    </CollapsibleContent>
  </Collapsible>
);
