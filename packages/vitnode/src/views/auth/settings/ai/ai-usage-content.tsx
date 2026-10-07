import { cn } from "cn";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import {
  type AiActionTranslate,
  translateAiActionText,
} from "@/lib/ai/action-text";
import { formatAiPoints } from "@/lib/ai/format-points";

import type { AiUsage, AiUsageAction } from "./ai-usage-query";

import {
  SETTINGS_ROW,
  SETTINGS_ROW_LABEL,
  SettingsGroup,
} from "../settings-group";

const AiUsageNoticeContent = ({ usage }: { usage: AiUsage }) => {
  const t = useTranslations("core.auth.settings.ai.notice");
  const format = useFormatter();
  const resetsAt = format.dateTime(new Date(usage.resetsAt), {
    dateStyle: "long",
  });

  if (!usage.enabled) {
    return (
      <Alert variant="info">
        <AlertTitle>{t("disabled.title")}</AlertTitle>
        <AlertDescription>{t("disabled.desc")}</AlertDescription>
      </Alert>
    );
  }

  // The site's own budget is checked first: a paused site is never the
  // member's doing, and telling them their allowance is the problem would be
  // wrong even when it happens to be low as well.
  if (usage.sitePaused || usage.notice === "site_paused") {
    return (
      <Alert variant="info">
        <AlertTitle>{t("site_paused.title")}</AlertTitle>
        <AlertDescription>{t("site_paused.desc")}</AlertDescription>
      </Alert>
    );
  }

  // Never had points is not the same as having spent them: no reset date,
  // and the way forward is a role, not waiting.
  if (usage.notice === "no_allowance") {
    return (
      <Alert variant="info">
        <AlertTitle>{t("no_allowance.title")}</AlertTitle>
        <AlertDescription>{t("no_allowance.desc")}</AlertDescription>
      </Alert>
    );
  }

  if (usage.notice === "exhausted") {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t("exhausted.title")}</AlertTitle>
        <AlertDescription>{t("exhausted.desc", { resetsAt })}</AlertDescription>
      </Alert>
    );
  }

  if (usage.notice === "near_limit") {
    return (
      <Alert variant="warning">
        <AlertTitle>{t("near_limit.title")}</AlertTitle>
        <AlertDescription>
          {t("near_limit.desc", { resetsAt })}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};

const AiPointsRow = ({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) => (
  <li className={SETTINGS_ROW}>
    <span className={SETTINGS_ROW_LABEL}>{label}</span>
    <span className="text-muted-foreground min-w-0 flex-1 text-end text-sm tabular-nums">
      {value}
    </span>
  </li>
);

export const AiPointsContent = ({ usage }: { usage: AiUsage }) => {
  const t = useTranslations("core.auth.settings.ai.points");
  const locale = useLocale();
  const format = useFormatter();
  const { available, reserved, total, used } = usage.points;
  const usedLabel = formatAiPoints(used, locale);
  const totalLabel = formatAiPoints(total, locale);
  const totalValue = total === null ? null : Number(total);
  const usedValue = Number(used);

  return (
    <SettingsGroup footer={t("footer")} title={t("title")}>
      <li className={cn(SETTINGS_ROW, "flex-col items-stretch gap-2")}>
        {totalValue === null ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">{t("used")}</span>
            <span className="text-sm tabular-nums">
              {t("used_unlimited", { used: usedLabel })}
            </span>
          </div>
        ) : (
          <Progress
            getAriaValueText={() =>
              t("used_of", { total: totalLabel, used: usedLabel })
            }
            max={Math.max(totalValue, 0)}
            min={0}
            value={Math.min(Math.max(usedValue, 0), Math.max(totalValue, 0))}
          >
            <ProgressLabel>{t("used")}</ProgressLabel>
            <span className="text-muted-foreground ms-auto text-sm tabular-nums">
              {t("used_of", { total: totalLabel, used: usedLabel })}
            </span>
          </Progress>
        )}
      </li>
      <AiPointsRow
        label={t("available")}
        value={
          available === null
            ? t("unlimited")
            : formatAiPoints(available, locale)
        }
      />
      <AiPointsRow
        label={t("reserved")}
        value={formatAiPoints(reserved, locale)}
      />
      <AiPointsRow
        label={t("resets")}
        value={format.dateTime(new Date(usage.resetsAt), {
          dateStyle: "long",
        })}
      />
    </SettingsGroup>
  );
};

const AiDailyLimitRow = ({ action }: { action: AiUsageAction }) => {
  const t = useTranslations("core.auth.settings.ai.daily");
  const tAll = useTranslations() as unknown as AiActionTranslate;

  return (
    <li className={cn(SETTINGS_ROW, "flex-wrap justify-between")}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-pretty">
          {action.description
            ? translateAiActionText(tAll, action.description)
            : action.key}
        </span>
        {action.description ? (
          <span className="text-muted-foreground truncate font-mono text-xs">
            {action.key}
          </span>
        ) : null}
      </div>
      <span className="text-muted-foreground text-sm tabular-nums">
        {action.dailyLimit === null
          ? t("no_limit", { used: action.usedToday })
          : t("used_of", { limit: action.dailyLimit, used: action.usedToday })}
      </span>
    </li>
  );
};

export const AiDailyLimitsContent = ({
  actions,
}: {
  actions: AiUsageAction[];
}) => {
  const t = useTranslations("core.auth.settings.ai.daily");

  return (
    <SettingsGroup footer={t("footer")} title={t("title")}>
      {actions.length === 0 ? (
        <li className={cn(SETTINGS_ROW, "text-muted-foreground text-sm")}>
          {t("empty")}
        </li>
      ) : (
        actions.map(action => (
          <AiDailyLimitRow action={action} key={action.key} />
        ))
      )}
    </SettingsGroup>
  );
};

export const AiUsageContent = ({ usage }: { usage: AiUsage }) => (
  <div className="flex flex-col gap-6">
    <AiUsageNoticeContent usage={usage} />
    <AiPointsContent usage={usage} />
    <AiDailyLimitsContent actions={usage.actions} />
  </div>
);
