import React from "react";

export interface AdminNavBadge {
  count: number;
  label: string;
}

export type AdminNavBadges = Readonly<Partial<Record<string, AdminNavBadge>>>;

const NO_BADGES: AdminNavBadges = {};

const AdminNavBadgesContext = React.createContext<AdminNavBadges>(NO_BADGES);

export const AdminNavBadgesProvider = ({
  children,
  value,
}: {
  children: React.ReactNode;
  value: AdminNavBadges;
}) => <AdminNavBadgesContext value={value}>{children}</AdminNavBadgesContext>;

export const useAdminNavBadges = (): AdminNavBadges =>
  React.use(AdminNavBadgesContext);

export const sumAdminNavBadges = (
  badges: AdminNavBadges,
  hrefs: readonly string[],
): AdminNavBadge | undefined => {
  const found = hrefs.flatMap(href => {
    const badge = badges[href];

    return badge === undefined ? [] : [badge];
  });
  if (found.length === 0) return undefined;

  return {
    count: found.reduce((total, badge) => total + badge.count, 0),
    label: found.map(badge => badge.label).join(", "),
  };
};

export const NavBadge = ({ badge }: { badge: AdminNavBadge | undefined }) =>
  badge === undefined ? null : (
    <span className="bg-primary text-primary-foreground ms-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-medium tabular-nums">
      <span aria-hidden>{badge.count}</span>
      <span className="sr-only">{badge.label}</span>
    </span>
  );

export const NavBadgeDot = ({ badge }: { badge: AdminNavBadge }) => (
  <>
    <span
      aria-hidden
      className="bg-primary ring-sidebar absolute -end-0.5 -top-0.5 size-2 rounded-full ring-2"
    />
    <span className="sr-only">{badge.label}</span>
  </>
);
