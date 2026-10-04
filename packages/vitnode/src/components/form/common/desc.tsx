import { cn } from "cn";

import { useFormDescriptionId } from "../../ui/form";

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
