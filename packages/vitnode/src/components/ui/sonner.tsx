import { cn } from "cn";
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { useTheme } from "../theme-provider";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Button } from "./button";

type ToastClassNames = NonNullable<
  NonNullable<ToasterProps["toastOptions"]>["classNames"]
>;

const toastClassNames: ToastClassNames = {
  toast: cn(
    "group/toast bg-popover text-popover-foreground flex w-(--width) items-start gap-3 rounded-2xl border p-4 shadow-lg",
    "focus-visible:ring-ring/50 focus-visible:ring-3",
    "*:transition-opacity *:duration-200 data-[expanded=false]:data-[front=false]:*:opacity-0 motion-reduce:*:transition-none",
  ),
  icon: cn(
    "relative flex size-5 shrink-0 items-center justify-center [&>svg]:size-4",
    "has-data-[slot=avatar]:size-9",
    "group-data-[type=info]/toast:text-primary group-data-[type=success]/toast:text-success group-data-[type=warning]/toast:text-warn group-data-[type=error]/toast:text-destructive",
  ),
  content: "flex min-w-0 flex-1 flex-col gap-0.5 self-center",
  title: cn(
    "text-sm leading-5 font-medium text-pretty",
    "group-data-[type=info]/toast:text-primary group-data-[type=success]/toast:text-success group-data-[type=warning]/toast:text-warn group-data-[type=error]/toast:text-destructive",
  ),
  description: "text-muted-foreground text-sm leading-relaxed text-pretty",
  actionButton: cn(
    "focus-visible:ring-ring/50 inline-flex h-7 shrink-0 cursor-pointer items-center self-center rounded-md px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-3",
    "bg-primary text-primary-foreground hover:bg-primary/90",
    "group-data-[type=info]/toast:bg-primary/10 group-data-[type=info]/toast:text-primary group-data-[type=info]/toast:hover:bg-primary/20",
    "group-data-[type=success]/toast:bg-success/10 group-data-[type=success]/toast:text-success group-data-[type=success]/toast:hover:bg-success/20",
    "group-data-[type=warning]/toast:bg-warn/10 group-data-[type=warning]/toast:text-warn group-data-[type=warning]/toast:hover:bg-warn/20",
    "group-data-[type=error]/toast:bg-destructive/10 group-data-[type=error]/toast:text-destructive group-data-[type=error]/toast:hover:bg-destructive/20",
  ),
  cancelButton:
    "bg-secondary text-secondary-foreground hover:bg-muted inline-flex h-7 shrink-0 cursor-pointer items-center self-center rounded-md px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
  closeButton: cn(
    "bg-popover text-muted-foreground hover:text-foreground absolute -end-1.5 -top-1.5 flex size-5 cursor-pointer items-center justify-center rounded-full border shadow-xs transition-opacity duration-150 outline-none [&>svg]:size-3",
    "focus-visible:ring-ring/50 opacity-0 group-focus-within/toast:opacity-100 group-hover/toast:opacity-100 focus-visible:ring-3 motion-reduce:transition-none pointer-coarse:opacity-100",
  ),
};

const mergeClassNames = (overrides: ToastClassNames = {}) => {
  const merged: ToastClassNames = { ...overrides };

  for (const key of Object.keys(toastClassNames) as (keyof ToastClassNames)[]) {
    merged[key] = cn(toastClassNames[key], overrides[key]);
  }

  return merged;
};

const Toaster = ({
  position = "top-right",
  toastOptions,
  ...props
}: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <CircleCheckIcon />,
        info: <InfoIcon />,
        warning: <TriangleAlertIcon />,
        error: <OctagonXIcon />,
        loading: <Loader2Icon className="animate-spin" />,
        close: <XIcon />,
      }}
      position={position}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-bg-hover": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--normal-border-hover": "var(--border)",
        } as React.CSSProperties
      }
      theme={theme as ToasterProps["theme"]}
      toastOptions={{
        unstyled: true,
        ...toastOptions,
        classNames: mergeClassNames(toastOptions?.classNames),
      }}
      {...props}
    />
  );
};

const ToastAvatar = ({
  alt,
  fallback,
  size,
  src,
}: {
  alt: string;
  fallback?: React.ReactNode;
  size?: React.ComponentProps<typeof Avatar>["size"];
  src?: null | string;
}) => (
  <Avatar size={size}>
    {src ? <AvatarImage alt={alt} src={src} /> : null}
    <AvatarFallback>{fallback ?? alt.charAt(0).toUpperCase()}</AvatarFallback>
  </Avatar>
);

interface ToastMessageAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "secondary";
}

const ToastMessage = ({
  actions = [],
  avatar,
  description,
  time,
  title,
}: {
  actions?: ToastMessageAction[];
  avatar: React.ComponentProps<typeof ToastAvatar>;
  description?: React.ReactNode;
  time?: React.ReactNode;
  title: React.ReactNode;
}) => (
  <div className="flex w-full items-start gap-3" data-slot="toast-message">
    <ToastAvatar {...avatar} size="lg" />
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate text-sm font-medium">{title}</p>
        {!!time && (
          <span className="text-muted-foreground shrink-0 text-xs">{time}</span>
        )}
      </div>
      {!!description && (
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {description}
        </p>
      )}
      {actions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {actions.map(action => (
            <Button
              key={action.label}
              onClick={action.onClick}
              size="sm"
              variant={action.variant ?? "default"}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  </div>
);

export { ToastAvatar, Toaster, ToastMessage };
