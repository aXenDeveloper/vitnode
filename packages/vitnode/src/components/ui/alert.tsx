import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import React from "react";

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-lg border px-4 py-3 text-start text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pe-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        success:
          "border-green-500/30 bg-green-500/10 text-green-800 *:data-[slot=alert-description]:text-green-700 *:[svg]:text-green-600 dark:text-green-200 dark:*:data-[slot=alert-description]:text-green-300 dark:*:[svg]:text-green-400",
        warning:
          "border-amber-500/30 bg-amber-500/10 text-amber-800 *:data-[slot=alert-description]:text-amber-700 *:[svg]:text-amber-600 dark:text-amber-200 dark:*:data-[slot=alert-description]:text-amber-300 dark:*:[svg]:text-amber-400",
        destructive:
          "border-red-500/30 bg-red-500/10 text-red-800 *:data-[slot=alert-description]:text-red-700 *:[svg]:text-red-600 dark:text-red-200 dark:*:data-[slot=alert-description]:text-red-300 dark:*:[svg]:text-red-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      className={cn(alertVariants({ variant }), className)}
      data-slot="alert"
      role="alert"
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "[&_a]:hover:text-foreground font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3",
        className,
      )}
      data-slot="alert-title"
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-muted-foreground [&_a]:hover:text-foreground text-sm text-balance md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4",
        className,
      )}
      data-slot="alert-description"
      {...props}
    />
  );
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("absolute end-3 top-2.5", className)}
      data-slot="alert-action"
      {...props}
    />
  );
}

export { Alert, AlertAction, AlertDescription, AlertTitle };
