import { cn } from "@/lib/utils";

export const AutoFormDesc = ({
  children,
  className,
  ...props
}: React.ComponentProps<"p">) => {
  return (
    <p className={cn("text-muted-foreground text-sm", className)} {...props}>
      {children}
    </p>
  );
};
