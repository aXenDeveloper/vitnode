import { cn } from "cn";
import {
  CircleCheckIcon,
  CircleXIcon,
  InfoIcon,
  TriangleAlertIcon,
} from "lucide-react";
import React from "react";

const ALERT_VARIANTS = {
  default: {
    bar: "bg-muted-foreground/50",
    icon: "[&_svg]:fill-muted-foreground",
    Icon: InfoIcon,
  },
  info: {
    bar: "bg-primary/50",
    icon: "[&_svg]:fill-primary",
    Icon: InfoIcon,
  },
  success: {
    bar: "bg-success/50",
    icon: "[&_svg]:fill-success",
    Icon: CircleCheckIcon,
  },
  warning: {
    bar: "bg-warn/50",
    icon: "[&_svg]:fill-warn",
    Icon: TriangleAlertIcon,
  },
  destructive: {
    bar: "bg-destructive/50",
    icon: "[&_svg]:fill-destructive",
    Icon: CircleXIcon,
  },
} as const;

export type AlertVariant = keyof typeof ALERT_VARIANTS;

function Alert({
  className,
  variant = "default",
  icon,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  icon?: React.ReactNode;
  variant?: AlertVariant;
}) {
  const { bar, icon: iconClassName, Icon } = ALERT_VARIANTS[variant];

  return (
    <div
      className={cn(
        "group/alert bg-card text-card-foreground relative flex w-full gap-2 rounded-xl border p-3 ps-1 text-start text-sm shadow-md has-data-[slot=alert-action]:pe-12",
        className,
      )}
      data-slot="alert"
      data-variant={variant}
      role="alert"
      {...props}
    >
      <div
        className={cn("w-0.5 shrink-0 rounded-sm", bar)}
        data-slot="alert-bar"
        role="none"
      />
      {icon !== null && (
        <span
          aria-hidden="true"
          className={cn(
            "text-card -me-0.5 flex shrink-0 [&_svg]:size-5",
            iconClassName,
          )}
          data-slot="alert-icon"
        >
          {icon ?? <Icon />}
        </span>
      )}
      <div
        className="flex min-w-0 flex-1 flex-col gap-2"
        data-slot="alert-content"
      >
        {children}
      </div>
    </div>
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "[&_a]:hover:text-foreground font-medium [&_a]:underline [&_a]:underline-offset-3",
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
        "text-muted-foreground [&_a]:hover:text-foreground text-sm leading-relaxed text-balance empty:hidden md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4",
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
