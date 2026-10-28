import { useSuspenseQuery } from "@tanstack/react-query";
import { TriangleAlertIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/page-title";
import { WarnDialog } from "@/tanstack/moderation/warn-button";

import { Person } from "../modcp/report-tone";
import { SanctionCard, StaffWarningCard } from "./warning-list";
import { memberStandingQueryOptions } from "./warnings-api";

const Section = ({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) => {
  const id = React.useId();

  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2
        className="text-foreground text-lg font-semibold text-balance"
        id={id}
      >
        {title}
      </h2>
      {children}
    </section>
  );
};

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="text-muted-foreground bg-card ring-foreground/5 rounded-xl p-4 text-sm leading-relaxed ring-1">
    {children}
  </p>
);

/** A member's standing in the ModCP: points, warnings and suspensions. */
export const ModcpMemberContent = ({ userId }: { userId: number }) => {
  const t = useTranslations("core.moderation.warn");
  const { data } = useSuspenseQuery(memberStandingQueryOptions(userId));
  const [warning, setWarning] = React.useState(false);
  const { permissions } = data;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        desc={t("member.desc")}
        h1={t("member.title", { name: data.user.name })}
      >
        {permissions.warn ? (
          <Button
            onClick={() => {
              setWarning(true);
            }}
            variant="destructive"
          >
            <TriangleAlertIcon aria-hidden="true" />
            {t("button_member")}
          </Button>
        ) : null}
      </PageTitle>

      <div className="bg-card ring-foreground/5 flex flex-col gap-4 rounded-xl p-4 shadow-xs ring-1 sm:flex-row sm:items-center sm:justify-between dark:shadow-none">
        <Person link person={data.user} size={40} />
        <dl className="flex gap-6">
          <div className="flex flex-col">
            <dt className="text-muted-foreground text-xs font-medium">
              {t("member.active_points")}
            </dt>
            <dd className="text-foreground text-2xl font-semibold tabular-nums">
              {data.activePoints}
            </dd>
          </div>
          {data.sanctions ? (
            <div className="flex flex-col">
              <dt className="text-muted-foreground text-xs font-medium">
                {t("member.status")}
              </dt>
              <dd className="text-foreground text-sm font-medium">
                {data.sanctions.some(sanction => sanction.active)
                  ? t("member.suspended")
                  : t("member.in_good_standing")}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      {data.sanctions ? (
        <Section title={t("member.sanctions")}>
          {data.sanctions.length === 0 ? (
            <Empty>{t("member.no_sanctions")}</Empty>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.sanctions.map(sanction => (
                <li key={sanction.id}>
                  <SanctionCard
                    canManage={permissions.manageSanctions}
                    sanction={sanction}
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}

      <Section title={t("member.warnings")}>
        {data.hiddenWarnings > 0 ? (
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {t("member.hidden_warnings", { count: data.hiddenWarnings })}
          </p>
        ) : null}
        {data.warnings.length === 0 ? (
          <Empty>{t("member.no_warnings")}</Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.warnings.map(item => (
              <li key={item.id}>
                <StaffWarningCard
                  canRevoke={permissions.revoke}
                  warning={item}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <WarnDialog onOpenChange={setWarning} open={warning} userId={userId} />
    </div>
  );
};
