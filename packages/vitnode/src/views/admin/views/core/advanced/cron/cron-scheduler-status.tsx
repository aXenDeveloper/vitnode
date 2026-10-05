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

const STATE_TONE = {
  ok: "bg-success/10 text-success",
  overdue: "bg-warn/10 text-warn",
  stopped: "bg-destructive/10 text-destructive",
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

const schedulerStateOf = (health: CronHealth): SchedulerState => {
  if (health.stale) return "stopped";

  return health.overdueJobs > 0 ? "overdue" : "ok";
};

const StatusTitle = ({
  health,
  state,
}: {
  health: CronHealth;
  state: SchedulerState;
}) => {
  const t = useTranslations("admin.advanced.cron.health");

  if (state === "stopped") return t("stale.title");
  if (state === "overdue") {
    return t("overdue.title", { count: health.overdueJobs });
  }

  return t("ok.title");
};

const StatusDescription = ({
  lastRun,
  state,
}: {
  lastRun: CronHealth["lastRun"];
  state: SchedulerState;
}) => {
  const t = useTranslations("admin.advanced.cron.health");

  if (state === "overdue") return t("overdue.desc");
  if (state === "ok") return t("ok.desc");
  if (!lastRun) return t("stale.desc_never");

  return (
    <>
      {t.rich("stale.desc", {
        date: () => <DateFormat date={lastRun} showFullDate />,
      })}
    </>
  );
};

const StatusHelp = ({ health }: { health: CronHealth }) => {
  const t = useTranslations("admin.advanced.cron.health");

  return (
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
  );
};

export const CronSchedulerStatus = ({ health }: { health: CronHealth }) => {
  const t = useTranslations("admin.advanced.cron.health");
  const state = schedulerStateOf(health);
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
            STATE_TONE[state],
          )}
        >
          <Icon aria-hidden />
        </span>

        <div className="flex min-w-0 flex-col gap-1">
          <h2
            className="text-lg font-semibold text-balance"
            id="cron-scheduler-status"
          >
            <StatusTitle health={health} state={state} />
          </h2>

          <p className="text-muted-foreground max-w-prose text-sm leading-relaxed text-pretty">
            <StatusDescription lastRun={lastRun} state={state} />
          </p>

          {(state === "stopped" || health.secretRejected) && (
            <StatusHelp health={health} />
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
