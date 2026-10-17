import { ShieldAlertIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { useAdminUpdateSummary } from "@/views/admin/views/core/system/plugins/update-summary-query";

import { AdminLink } from "./admin-link";
import { ADMIN_PLUGINS_HREF } from "./sidebar/nav/nav-model";

/**
 * One line across the top of every AdminCP page while a security update
 * affects something installed. Gone as soon as no evaluated finding applies -
 * but never because a publisher could not be reached: a failed check keeps the
 * last known findings, and says so.
 */
export const AdminUpdateSecurityBanner = () => {
  const t = useTranslations("admin.global.updates.security_banner");
  const { data } = useAdminUpdateSummary();

  if (!data?.enabled || data.affectedComponents === 0) return null;

  const lastKnown = data.failedComponents > 0 || data.stale;

  return (
    <section
      aria-labelledby="admin-security-banner-title"
      className="border-destructive/30 bg-destructive/10 text-foreground flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-sm leading-relaxed"
    >
      <ShieldAlertIcon
        aria-hidden
        className="text-destructive size-4 shrink-0"
      />
      <p className="min-w-0 flex-1 text-pretty">
        <strong className="font-medium" id="admin-security-banner-title">
          {t("title", { count: data.affectedComponents })}
        </strong>{" "}
        {lastKnown ? (
          <span className="text-muted-foreground">{t("last_known")}</span>
        ) : null}
      </p>
      <AdminLink
        className="text-destructive font-medium underline-offset-4 hover:underline"
        href={ADMIN_PLUGINS_HREF}
      >
        {t("review")}
      </AdminLink>
    </section>
  );
};
