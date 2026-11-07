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

const STATUS_VARIANT = {
  active: "warning",
  expired: "secondary",
  revoked: "outline",
} as const;

export const WarningStatusBadge = ({ status }: { status: WarningStatus }) => {
  const t = useTranslations("core.moderation.warn.statuses");

  return <Badge variant={STATUS_VARIANT[status]}>{t(status)}</Badge>;
};
