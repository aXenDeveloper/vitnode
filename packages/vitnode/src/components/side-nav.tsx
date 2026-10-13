import { Link } from "@tanstack/react-router";
import { cn } from "cn";

export const SideNavCard = ({
  className,
  ...props
}: React.ComponentProps<"nav">) => (
  <nav
    className={cn(
      "bg-card ring-foreground/5 rounded-xl p-2 shadow-xs ring-1 dark:shadow-none",
      className,
    )}
    {...props}
  />
);

export const SideNavList = ({ children }: { children: React.ReactNode }) => (
  <ul className="flex flex-col gap-0.5">{children}</ul>
);

export const SideNavLink = ({
  count,
  icon: Icon,
  isActive,
  label,
  onNavigate,
  to,
}: {
  count?: number;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  label: string;
  onNavigate?: () => void;
  to: string;
}) => (
  <li>
    <Link
      activeOptions={{ exact: true }}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "focus-visible:ring-ring/50 flex h-11 items-center gap-2.5 rounded-sm px-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 md:h-9",
        isActive
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
      onClick={onNavigate}
      to={to}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
      {count ? (
        <span className="ms-auto min-w-6 text-center text-xs tabular-nums">
          {count}
        </span>
      ) : null}
    </Link>
  </li>
);
