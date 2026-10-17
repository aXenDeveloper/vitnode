import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import React from "react";

import { glideSidebarIndicators } from "./ui/sidebar-glide";

export const SideNav = ({
  children,
  className,
  ...props
}: React.ComponentProps<"nav">) => {
  const ref = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (!ref.current) return;

    return glideSidebarIndicators(ref.current);
  }, []);

  return (
    <nav
      className={cn("group/side-nav relative text-sm", className)}
      ref={ref}
      {...props}
    >
      <span
        aria-hidden
        className="bg-accent ease-fluid pointer-events-none absolute top-0 left-0 rounded-lg opacity-0 transition-[translate,width,height,opacity,scale] duration-200 data-hidden:duration-150 data-pressed:scale-98 motion-reduce:transition-opacity"
        data-sidebar="hover-indicator"
      />
      <span
        aria-hidden
        className="bg-primary/10 ease-fluid pointer-events-none absolute top-0 left-0 rounded-lg opacity-0 transition-[scale] duration-200 data-pressed:scale-98 motion-reduce:transition-none"
        data-sidebar="active-indicator"
      />
      {children}
    </nav>
  );
};

export const SideNavGroup = ({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) => (
  <div className="mt-6 flex flex-col first:mt-0">
    {title ? (
      <p className="text-muted-foreground mb-1.5 px-2.5 text-xs font-medium">
        {title}
      </p>
    ) : null}
    {children}
  </div>
);

export const SideNavList = ({ children }: { children: React.ReactNode }) => (
  <ul className="flex flex-col gap-0.5">{children}</ul>
);

export const SideNavLink = ({
  count,
  countClassName,
  icon: Icon,
  isActive,
  label,
  onNavigate,
  to,
}: {
  count?: number;
  countClassName?: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  label: string;
  onNavigate?: () => void;
  to: string;
}) => (
  <li>
    <Link
      activeOptions={{ exact: true, includeSearch: false }}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "focus-visible:ring-ring/50 relative flex h-11 items-center gap-3 rounded-lg px-2.5 text-sm transition-[color,background-color,scale] outline-none focus-visible:ring-3 active:scale-98 md:h-9",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        "group-data-glide/side-nav:bg-transparent group-data-glide/side-nav:hover:bg-transparent group-data-glide/side-nav:active:scale-100",
      )}
      data-active={isActive ? "" : undefined}
      data-sidebar="menu-button"
      onClick={onNavigate}
      to={to}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
      {count ? (
        <span
          className={cn(
            "ms-auto min-w-6 text-center text-xs tabular-nums",
            countClassName,
          )}
        >
          {count}
        </span>
      ) : null}
    </Link>
  </li>
);
