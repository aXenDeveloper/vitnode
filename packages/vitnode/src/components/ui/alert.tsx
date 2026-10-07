import { cn } from "cn";
import {
  CircleCheckIcon,
  CircleXIcon,
  InfoIcon,
  TriangleAlertIcon,
} from "lucide-react";
import React from "react";

const ALERT_VARIANTS: Record<
  "default" | "destructive" | "info" | "success" | "warning",
  {
    Icon: null | React.ComponentType;
    icon: string;
    role: "alert" | "status";
    surface: string;
  }
> = {
  default: {
    surface: "border-border bg-card",
    icon: "text-muted-foreground",
    Icon: null,
    role: "status",
  },
  info: {
    surface: "border-primary/30 bg-primary/5 dark:border-primary/40",
    icon: "text-primary",
    Icon: InfoIcon,
    role: "status",
  },
  success: {
    surface: "border-success/30 bg-success/5 dark:border-success/40",
    icon: "text-success",
    Icon: CircleCheckIcon,
    role: "status",
  },
  warning: {
    surface: "border-warn/30 bg-warn/5 dark:border-warn/40",
    icon: "text-warn",
    Icon: TriangleAlertIcon,
    role: "alert",
  },
  destructive: {
    surface:
      "border-destructive/30 bg-destructive/5 dark:border-destructive/40",
    icon: "text-destructive",
    Icon: CircleXIcon,
    role: "alert",
  },
};

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
  const { surface, icon: iconClassName, Icon, role } = ALERT_VARIANTS[variant];
  const resolvedIcon = icon === undefined ? Icon && <Icon /> : icon;

  return (
    <div
      className={cn(
        "group/alert text-foreground relative flex w-full gap-2.5 rounded-xl border px-4 py-3 text-start text-sm shadow-xs has-data-[slot=alert-action]:pe-12",
        surface,
        className,
      )}
      data-slot="alert"
      data-variant={variant}
      role={role}
      {...props}
    >
      {resolvedIcon !== null && (
        <span
          aria-hidden="true"
          className={cn(
            "flex h-5 shrink-0 items-center [&_svg]:size-4",
            iconClassName,
          )}
          data-slot="alert-icon"
        >
          {resolvedIcon}
        </span>
      )}
      <div
        className="flex min-w-0 flex-1 flex-col gap-1"
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
