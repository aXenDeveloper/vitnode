"use client";

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

import { Skeleton } from "@/components/ui/skeleton";

import type { AdminIntegrations } from "./integrations-query";
import type { SendTestEmail } from "./send-test-email/send-test-email-mutation";

import { IntegrationCard, type IntegrationStatus } from "./integration-card";
import { SendTestEmailAction } from "./send-test-email/send-test-email";
import { TestAIAction } from "./test-ai/test-ai";
import { TestStorageAction } from "./test-storage/test-storage";

/**
 * The integrations board, as a grid both frameworks render.
 *
 * Nine cards, three of which carry a test action, and the small amount of logic
 * that turns each subsystem's report into one of three statuses - `active`,
 * `warning`, `inactive`. Fetching and translation are lifted out to whoever is
 * rendering it.
 *
 *     Next.js         integrations-view.tsx            fetch + permission reads
 *     TanStack Start  routes/_admin/…/system/integrations  loader + useSuspenseQuery
 *                                        \       /
 *                                 IntegrationsContent
 *
 * The three `can*` flags arrive as props rather than being read from the
 * permission context here, for the same reason the file table's do: the Next.js
 * page resolves them on the server with `checkAdminPermissionApi`, and reading
 * them from a React context instead would suspend this component on a promise
 * the AdminCP layout is still holding. Either way they hide a control - the API
 * re-checks `system.can_send_test_email`, `system.can_test_storage` and
 * `system.can_test_ai` on the requests themselves.
 */

/**
 * Where each card's "read more" goes.
 *
 * Absolute `vitnode.com` links rather than in-app routes: these are the
 * framework's own documentation, they are the same for every installation, and
 * they open in a new tab.
 */
const DOCS_URLS = {
  ai: "https://vitnode.com/docs/dev/ai",
  captcha: "https://vitnode.com/docs/dev/captcha",
  contentPreview: "https://vitnode.com/docs/dev/content-engine/preview",
  cron: "https://vitnode.com/docs/dev/cron",
  email: "https://vitnode.com/docs/dev/email",
  queue: "https://vitnode.com/docs/dev/advanced/queue",
  redis: "https://vitnode.com/docs/dev/advanced/redis",
  storage: "https://vitnode.com/docs/dev/storage",
  websocket: "https://vitnode.com/docs/dev/websocket",
};

const toStatus = (active: boolean): IntegrationStatus =>
  active ? "active" : "inactive";

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

  const redisStatus: IntegrationStatus = data.redis.active
    ? "active"
    : data.redis.configuredButDown
      ? "warning"
      : "inactive";

  const contentPreviewStatus: IntegrationStatus = data.contentPreview.active
    ? "active"
    : "inactive";

  const cronStatus: IntegrationStatus = !data.cron.active
    ? "inactive"
    : data.cron.stale || !data.cron.secure
      ? "warning"
      : "active";

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
            <span className="text-amber-600 dark:text-amber-400">
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

      <IntegrationCard
        description={t("cron.desc")}
        href={DOCS_URLS.cron}
        Icon={ClockIcon}
        meta={
          !data.cron.active ? (
            <span>{t("cron.not_configured")}</span>
          ) : data.cron.stale ? (
            <span className="text-amber-600 dark:text-amber-400">
              {t("cron.stale")}
            </span>
          ) : !data.cron.secure ? (
            <span className="text-amber-600 dark:text-amber-400">
              {t("cron.insecure")}
            </span>
          ) : (
            <span>{t("cron.jobs", { count: data.cron.jobs })}</span>
          )
        }
        readMoreLabel={t("read_more")}
        status={cronStatus}
        statusLabel={statusLabel(cronStatus)}
        title={t("cron.title")}
      />

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

/**
 * The board's shape before its data arrives.
 *
 * Framework-free and beside the board rather than inside it, because a Suspense
 * fallback is rendered *outside* the component it is standing in for - the
 * Next.js page mounts it above `<IntegrationsView>`.
 */
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
