import { cn } from "cn";
import { CircleCheckIcon, CircleXIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { DOCS_URLS } from "@/lib/docs-links";

import type { CronHealth } from "./cron-query";

type SchedulerState = "ok" | "overdue" | "stopped";

const STATE_ICON = {
  ok: CircleCheckIcon,
  overdue: TriangleAlertIcon,
  stopped: CircleXIcon,
} as const;

const DocsLink = ({ children }: { children: React.ReactNode }) => (
  <a
    className="text-primary underline-offset-4 hover:underline"
    href={DOCS_URLS.cron}
    rel="noopener noreferrer"
    target="_blank"
  >
    {children}
  </a>
);

const Fact = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) => (
  <div className="flex flex-col gap-1">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="font-medium tabular-nums">{children}</dd>
  </div>
);

export const CronSchedulerStatus = ({ health }: { health: CronHealth }) => {
  const t = useTranslations("admin.advanced.cron.health");
  const state: SchedulerState = health.stale
    ? "stopped"
    : health.overdueJobs > 0
      ? "overdue"
      : "ok";
  const Icon = STATE_ICON[state];
  const lastRun = health.lastRun;

  return (
    <section
      aria-labelledby="cron-scheduler-status"
      className="bg-card text-card-foreground ring-foreground/10 flex flex-col gap-5 rounded-xl p-5 shadow-xs ring-1 md:flex-row md:items-center md:justify-between"
      data-state={state}
    >
      <div className="flex items-start gap-4">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-5",
            state === "stopped" && "bg-destructive/10 text-destructive",
            state === "overdue" && "bg-warn/10 text-warn",
            state === "ok" && "bg-success/10 text-success",
          )}
        >
          <Icon aria-hidden />
        </span>

        <div className="flex min-w-0 flex-col gap-1">
          <h2
            className="text-lg font-semibold text-balance"
            id="cron-scheduler-status"
          >
            {state === "stopped"
              ? t("stale.title")
              : state === "overdue"
                ? t("overdue.title", { count: health.overdueJobs })
                : t("ok.title")}
          </h2>

          <p className="text-muted-foreground max-w-prose text-sm leading-relaxed text-pretty">
            {state === "stopped"
              ? lastRun
                ? t.rich("stale.desc", {
                    date: () => <DateFormat date={lastRun} showFullDate />,
                  })
                : t("stale.desc_never")
              : state === "overdue"
                ? t("overdue.desc")
                : t("ok.desc")}
          </p>

          {(state === "stopped" || health.secretRejected) && (
            <p className="text-sm leading-relaxed text-pretty">
              {health.secretRejected ? (
                <>{t("secret_rejected")} </>
              ) : (
                !health.active && <>{t("no_adapter")} </>
              )}
              {t.rich("stale.help", {
                docs: text => <DocsLink>{text}</DocsLink>,
              })}
            </p>
          )}
        </div>
      </div>

      <dl className="grid shrink-0 grid-cols-3 gap-4 text-sm md:gap-6">
        <Fact label={t("facts.last_run")}>
          {lastRun ? <DateFormat date={lastRun} /> : t("facts.never")}
        </Fact>
        <Fact label={t("facts.next_run")}>
          {health.nextRun && !health.stale ? (
            <DateFormat date={health.nextRun} />
          ) : (
            "—"
          )}
        </Fact>
        <Fact label={t("facts.jobs")}>{health.jobs}</Fact>
      </dl>
    </section>
  );
};
