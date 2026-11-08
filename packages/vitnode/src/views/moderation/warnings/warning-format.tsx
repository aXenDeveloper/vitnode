import { useTranslations } from "use-intl";

import type { WarningStatus } from "@/lib/moderation/warnings";

import { Badge } from "@/components/ui/badge";

/** A number of hours, as whole days when it divides evenly. */
export const WarningDuration = ({ hours }: { hours: number }) => {
  const t = useTranslations("core.moderation.warn.duration");

  return (
    <>
      {hours % 24 === 0
        ? t("days", { count: hours / 24 })
        : t("hours", { count: hours })}
    </>
  );
};

export const SUSPENSION_DURATION_UNITS = ["minutes", "hours", "days"] as const;

export type SuspensionDurationUnit = (typeof SUSPENSION_DURATION_UNITS)[number];

export const MINUTES_PER_UNIT: Record<SuspensionDurationUnit, number> = {
  days: 60 * 24,
  hours: 60,
  minutes: 1,
};

/** The largest whole unit a number of minutes divides into. Pure. */
export const splitSuspensionMinutes = (
  minutes: number,
): { count: number; unit: SuspensionDurationUnit } => {
  const unit =
    SUSPENSION_DURATION_UNITS.toReversed().find(
      candidate => minutes % MINUTES_PER_UNIT[candidate] === 0,
    ) ?? "minutes";

  return { count: minutes / MINUTES_PER_UNIT[unit], unit };
};

/** A suspension length in minutes, as days, hours or minutes. */
export const SuspensionDuration = ({ minutes }: { minutes: number }) => {
  const t = useTranslations("core.moderation.warn.duration");
  const { count, unit } = splitSuspensionMinutes(minutes);

  return <>{t(unit, { count })}</>;
};

const STATUS_VARIANT = {
  active: "warning",
  expired: "secondary",
  revoked: "outline",
} as const;

export const WarningStatusBadge = ({ status }: { status: WarningStatus }) => {
  const t = useTranslations("core.moderation.warn.statuses");

  return <Badge variant={STATUS_VARIANT[status]}>{t(status)}</Badge>;
};
