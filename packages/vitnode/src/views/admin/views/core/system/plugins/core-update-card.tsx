import { PackageIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";

import type { AdminPluginUpdates } from "./plugin-updates-query";

import { PluginUpdateStatus, SecurityUpdates } from "./plugin-update-status";

const lastCheckedOf = (updates: AdminPluginUpdates): null | string =>
  [updates.core, ...updates.plugins]
    .map(component => component.lastSuccessAt)
    .reduce<null | string>(
      (latest, value) =>
        value !== null && (latest === null || value > latest) ? value : latest,
      null,
    );

const CheckSummary = ({ updates }: { updates: AdminPluginUpdates }) => {
  const t = useTranslations("admin.system.plugins.updates");

  if (!updates.enabled) return <>{t("summary.disabled")}</>;

  const lastChecked = lastCheckedOf(updates);
  if (lastChecked === null) return <>{t("summary.never")}</>;

  return (
    <>
      {t.rich("summary.last_checked", {
        date: () => <DateFormat date={lastChecked} />,
      })}
    </>
  );
};

/**
 * Core's own row, kept apart from the plugins: its version, its update status
 * and any securityUpdate against it, plus when everything was last checked.
 */
export const CoreUpdateCard = ({
  updates,
  version,
}: {
  updates: AdminPluginUpdates | undefined;
  version: string;
}) => {
  const t = useTranslations("admin.system.plugins");

  return (
    <section
      aria-labelledby="vitnode-core-version"
      className="bg-card text-card-foreground ring-foreground/10 flex flex-col gap-4 rounded-xl p-5 shadow-xs ring-1"
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg"
        >
          <PackageIcon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2
            className="text-lg font-semibold text-balance"
            id="vitnode-core-version"
          >
            {t("core.title")}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t.rich("core.version", {
              version,
              mono: chunks => (
                <span className="text-foreground font-mono">{chunks}</span>
              ),
            })}
          </p>
          <PluginUpdateStatus
            coreVersion={version}
            enabled={updates?.enabled ?? true}
            showCheckedAt={false}
            update={updates?.core}
          />
        </div>
      </div>

      <SecurityUpdates update={updates?.core} />

      {updates === undefined ? null : (
        <div className="text-muted-foreground border-border flex flex-col gap-1 border-t pt-3 text-sm leading-relaxed">
          <p className="text-pretty">
            <CheckSummary updates={updates} />
          </p>
          {updates.channelOverride === null ? null : (
            <p>
              {t("updates.summary.channel", {
                channel: t(`updates.channel.${updates.channelOverride}`),
              })}
            </p>
          )}
          <p className="text-pretty">{t("updates.summary.info")}</p>
        </div>
      )}
    </section>
  );
};
