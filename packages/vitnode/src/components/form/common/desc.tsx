import { cn } from "cn";

import { useFormDescriptionId } from "../../ui/form";

/**
 * A form field's help text, wired to the field through
 * `aria-describedby`. Render it inside a form field, below the control - for
 * a custom field component the same way built-in fields do.
 */
export const AutoFormDesc = ({
  children,
  className,
  ...props
}: React.ComponentProps<"p">) => {
  const descriptionId = useFormDescriptionId();

  return (
    <p
      className={cn("text-muted-foreground text-sm", className)}
      id={descriptionId}
      {...props}
    >
      {children}
    </p>
  );
};
