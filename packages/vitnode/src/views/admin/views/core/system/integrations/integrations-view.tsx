import {
  ClockIcon,
  DatabaseIcon,
  MailIcon,
  RadioTowerIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { debugAdminModule } from "@/api/modules/admin/debug/debug.admin.module";
import { Skeleton } from "@/components/ui/skeleton";
import { checkAdminPermissionApi } from "@/lib/api/get-session-admin-api";
import { fetcher } from "@/lib/fetcher";

import { IntegrationCard, type IntegrationStatus } from "./integration-card";
import { SendTestEmailAction } from "./send-test-email/send-test-email";

const DOCS_URLS = {
  captcha: "https://vitnode.com/docs/dev/captcha",
  cron: "https://vitnode.com/docs/dev/cron",
  email: "https://vitnode.com/docs/dev/email",
  redis: "https://vitnode.com/docs/dev/advanced/redis",
  websocket: "https://vitnode.com/docs/dev/websocket",
};

const getIntegrationsData = async () => {
  const res = await fetcher(debugAdminModule, {
    prefixPath: "/admin",
    path: "/integrations",
    method: "get",
    module: "debug",
  });

  return await res.json();
};

const toStatus = (active: boolean): IntegrationStatus =>
  active ? "active" : "inactive";

export const IntegrationsView = async () => {
  const [t, data, canSendTestEmail] = await Promise.all([
    getTranslations("admin.system.integrations"),
    getIntegrationsData(),
    checkAdminPermissionApi({
      module: "system",
      permission: "can_send_test_email",
    }),
  ]);

  const statusLabel = (status: IntegrationStatus) => t(`status.${status}`);

  const redisStatus: IntegrationStatus = data.redis.active
    ? "active"
    : data.redis.configuredButDown
      ? "warning"
      : "inactive";

  // "Active" means a cron adapter is configured (an in-process scheduler runs
  // the jobs); a configured-but-insecure secret is a warning, not a failure.
  const cronStatus: IntegrationStatus = !data.cron.active
    ? "inactive"
    : data.cron.secure
      ? "active"
      : "warning";

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
            <SendTestEmailAction />
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
        description={t("cron.desc")}
        href={DOCS_URLS.cron}
        Icon={ClockIcon}
        meta={
          !data.cron.active ? (
            <span>{t("cron.not_configured")}</span>
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
    {["websocket", "redis", "email", "cron", "captcha"].map(id => (
      <Skeleton className="h-32 w-full rounded-xl" key={id} />
    ))}
  </div>
);
