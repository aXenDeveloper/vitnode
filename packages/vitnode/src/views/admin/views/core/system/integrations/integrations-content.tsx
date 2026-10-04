import {
  ClockIcon,
  DatabaseIcon,
  EyeIcon,
  HardDriveIcon,
  ListTodoIcon,
  MailIcon,
  RadioTowerIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { Skeleton } from "@/components/ui/skeleton";
import { DOCS_URLS } from "@/lib/docs-links";

import type { AdminIntegrations } from "./integrations-query";
import type { SendTestEmail } from "./send-test-email/send-test-email-mutation";

import { IntegrationCard, type IntegrationStatus } from "./integration-card";
import { SendTestEmailAction } from "./send-test-email/send-test-email";
import { TestAIAction } from "./test-ai/test-ai";
import { TestStorageAction } from "./test-storage/test-storage";

const toStatus = (active: boolean): IntegrationStatus =>
  active ? "active" : "inactive";

const CronMeta = ({
  cron,
  failing,
}: {
  cron: AdminIntegrations["cron"];
  failing: boolean;
}) => {
  const t = useTranslations("admin.system.integrations.cron");
  const lastRun = cron.lastRun;

  if (failing && cron.stale) {
    return (
      <span className="text-destructive">
        {lastRun
          ? t.rich("stale", { date: () => <DateFormat date={lastRun} /> })
          : t("stale_never")}
      </span>
    );
  }
  if (failing) {
    return (
      <span className="text-amber-700 dark:text-amber-400">
        {t("overdue", { count: cron.overdueJobs })}
      </span>
    );
  }
  if (!cron.active) return <span>{t("not_configured")}</span>;
  if (!cron.secure) {
    return (
      <span className="text-amber-700 dark:text-amber-400">
        {t("insecure")}
      </span>
    );
  }

  return <span>{t("jobs", { count: cron.jobs })}</span>;
};

const cronStatusOf = (
  cron: AdminIntegrations["cron"],
  failing: boolean,
): IntegrationStatus => {
  if (failing) return "warning";
  if (!cron.active) return "inactive";

  return cron.secure ? "active" : "warning";
};

const CronIntegrationCard = ({ cron }: { cron: AdminIntegrations["cron"] }) => {
  const t = useTranslations("admin.system.integrations");
  const hasRun = cron.active || cron.lastRun !== null;
  const failing = hasRun && cron.overdueJobs > 0;
  const status = cronStatusOf(cron, failing);

  return (
    <IntegrationCard
      description={t("cron.desc")}
      href={DOCS_URLS.cron}
      Icon={ClockIcon}
      meta={<CronMeta cron={cron} failing={failing} />}
      readMoreLabel={t("read_more")}
      status={status}
      statusLabel={t(`status.${status}`)}
      title={t("cron.title")}
    />
  );
};

const redisStatusOf = (
  redis: AdminIntegrations["redis"],
): IntegrationStatus => {
  if (redis.active) return "active";

  return redis.configuredButDown ? "warning" : "inactive";
};

export const IntegrationsContent = ({
  canSendTestEmail,
  canTestAi,
  canTestStorage,
  data,
  onSendTestEmail,
}: {
  canSendTestEmail: boolean;
  canTestAi: boolean;
  canTestStorage: boolean;
  data: AdminIntegrations;
  onSendTestEmail: SendTestEmail;
}) => {
  const t = useTranslations("admin.system.integrations");
  const statusLabel = (status: IntegrationStatus) => t(`status.${status}`);

  const redisStatus = redisStatusOf(data.redis);

  const contentPreviewStatus: IntegrationStatus = data.contentPreview.active
    ? "active"
    : "inactive";

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <IntegrationCard
        action={
          data.ai.active && canTestAi ? (
            <TestAIAction models={data.ai.models} />
          ) : undefined
        }
        description={t("ai.desc")}
        href={DOCS_URLS.ai}
        Icon={SparklesIcon}
        meta={
          data.ai.active ? (
            <span>{t("ai.models", { count: data.ai.models.length })}</span>
          ) : null
        }
        readMoreLabel={t("read_more")}
        status={toStatus(data.ai.active)}
        statusLabel={statusLabel(toStatus(data.ai.active))}
        title={t("ai.title")}
      />

      <IntegrationCard
        description={t("websocket.desc")}
        href={DOCS_URLS.websocket}
        Icon={RadioTowerIcon}
        readMoreLabel={t("read_more")}
        status={toStatus(data.websocket.active)}
        statusLabel={statusLabel(toStatus(data.websocket.active))}
        title={t("websocket.title")}
      />

      <IntegrationCard
        description={t("redis.desc")}
        href={DOCS_URLS.redis}
        Icon={DatabaseIcon}
        meta={
          data.redis.configuredButDown ? (
            <span className="text-amber-700 dark:text-amber-400">
              {t("redis.down")}
            </span>
          ) : null
        }
        readMoreLabel={t("read_more")}
        status={redisStatus}
        statusLabel={statusLabel(redisStatus)}
        title={t("redis.title")}
      />

      <IntegrationCard
        action={
          data.email.active && canSendTestEmail ? (
            <SendTestEmailAction onSend={onSendTestEmail} />
          ) : undefined
        }
        description={t("email.desc")}
        href={DOCS_URLS.email}
        Icon={MailIcon}
        readMoreLabel={t("read_more")}
        status={toStatus(data.email.active)}
        statusLabel={statusLabel(toStatus(data.email.active))}
        title={t("email.title")}
      />

      <IntegrationCard
        action={
          data.storage.active && canTestStorage ? (
            <TestStorageAction />
          ) : undefined
        }
        description={t("storage.desc")}
        href={DOCS_URLS.storage}
        Icon={HardDriveIcon}
        readMoreLabel={t("read_more")}
        status={toStatus(data.storage.active)}
        statusLabel={statusLabel(toStatus(data.storage.active))}
        title={t("storage.title")}
      />

      <CronIntegrationCard cron={data.cron} />

      <IntegrationCard
        description={t("content_preview.desc")}
        href={DOCS_URLS.contentPreview}
        Icon={EyeIcon}
        meta={
          data.contentPreview.active ? (
            <span>
              {t("content_preview.content_types", {
                count: data.contentPreview.contentTypes,
              })}
            </span>
          ) : (
            <span>{t("content_preview.not_configured")}</span>
          )
        }
        readMoreLabel={t("read_more")}
        status={contentPreviewStatus}
        statusLabel={statusLabel(contentPreviewStatus)}
        title={t("content_preview.title")}
      />

      <IntegrationCard
        description={t("queue.desc")}
        href={DOCS_URLS.queue}
        Icon={ListTodoIcon}
        meta={
          <>
            <span>
              {t("queue.tasks", { count: data.queue.tasks })} ·{" "}
              {t("queue.queued", {
                pending: data.queue.pending,
                processing: data.queue.processing,
              })}
            </span>
            {data.queue.cronStale ? (
              <span className="text-destructive mt-1 block">
                {t("queue.cron_stale")}
              </span>
            ) : null}
          </>
        }
        readMoreLabel={t("read_more")}
        status={toStatus(data.queue.active)}
        statusLabel={statusLabel(toStatus(data.queue.active))}
        title={t("queue.title")}
      />

      <IntegrationCard
        description={t("captcha.desc")}
        href={DOCS_URLS.captcha}
        Icon={ShieldCheckIcon}
        meta={
          data.captcha.active && data.captcha.type ? (
            <span>{t(`captcha.type.${data.captcha.type}`)}</span>
          ) : null
        }
        readMoreLabel={t("read_more")}
        status={toStatus(data.captcha.active)}
        statusLabel={statusLabel(toStatus(data.captcha.active))}
        title={t("captcha.title")}
      />
    </div>
  );
};

export const IntegrationsViewSkeleton = () => (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {[
      "ai",
      "websocket",
      "redis",
      "email",
      "storage",
      "cron",
      "content_preview",
      "queue",
      "captcha",
    ].map(id => (
      <Skeleton className="h-32 w-full rounded-xl" key={id} />
    ))}
  </div>
);
