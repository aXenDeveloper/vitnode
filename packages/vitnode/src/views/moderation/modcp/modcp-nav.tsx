import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { ClipboardCheckIcon, FlagIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { SideNavCard, SideNavLink, SideNavList } from "@/components/side-nav";

import {
  modcpApprovalsQueryOptions,
  modcpReportsQueryOptions,
} from "./modcp-query";

export type ModcpNavKey = "approvals" | "reports";

interface ModcpNavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  key: ModcpNavKey;
}

export const MODCP_NAV_ITEMS: readonly ModcpNavItem[] = [
  { href: "/modcp/reports", icon: FlagIcon, key: "reports" },
  { href: "/modcp/approvals", icon: ClipboardCheckIcon, key: "approvals" },
];

const OPEN_REPORTS_FILTER = {
  assigned: "any",
  page: 1,
  pageSize: 1,
  status: "open",
} as const;

const PENDING_APPROVALS_FILTER = {
  page: 1,
  pageSize: 1,
  status: "pending",
} as const;

export const isModcpNavItemActive = (
  item: ModcpNavItem,
  pathname: string,
): boolean => pathname === item.href || pathname.startsWith(`${item.href}/`);

const useNavCounts = (): Partial<Record<ModcpNavKey, number>> => {
  const reports = useQuery(modcpReportsQueryOptions(OPEN_REPORTS_FILTER));
  const approvals = useQuery(
    modcpApprovalsQueryOptions(PENDING_APPROVALS_FILTER),
  );

  return { approvals: approvals.data?.total, reports: reports.data?.total };
};

const ModcpNavChip = ({
  count,
  isActive,
  item,
}: {
  count?: number;
  isActive: boolean;
  item: ModcpNavItem;
}) => {
  const t = useTranslations("core.moderation.modcp");
  const Icon = item.icon;

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "focus-visible:ring-ring/50 flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3",
        isActive
          ? "bg-foreground text-background"
          : "bg-card text-muted-foreground ring-foreground/5 shadow-xs ring-1",
      )}
      to={item.href}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {t(`${item.key}.title`)}
      {count ? (
        <span className="text-xs tabular-nums opacity-70">{count}</span>
      ) : null}
    </Link>
  );
};

export const ModcpNavContent = ({ pathname }: { pathname: string }) => {
  const t = useTranslations("core.moderation.modcp");
  const counts = useNavCounts();

  return (
    <>
      <nav
        aria-label={t("title")}
        className="-mx-4 overflow-x-auto px-4 md:hidden"
      >
        <ul className="flex w-max gap-2">
          {MODCP_NAV_ITEMS.map(item => (
            <li key={item.key}>
              <ModcpNavChip
                count={counts[item.key]}
                isActive={isModcpNavItemActive(item, pathname)}
                item={item}
              />
            </li>
          ))}
        </ul>
      </nav>

      <SideNavCard aria-label={t("title")} className="max-md:hidden">
        <SideNavList>
          {MODCP_NAV_ITEMS.map(item => (
            <SideNavLink
              count={counts[item.key]}
              icon={item.icon}
              isActive={isModcpNavItemActive(item, pathname)}
              key={item.key}
              label={t(`${item.key}.title`)}
              to={item.href}
            />
          ))}
        </SideNavList>
      </SideNavCard>
    </>
  );
};
