import { cn } from "cn";

/**
 * A pulsing placeholder block for loading content; hidden from screen readers.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("bg-muted rounded-md motion-safe:animate-pulse", className)}
      data-slot="skeleton"
      {...props}
    />
  );
}

export { Skeleton };
