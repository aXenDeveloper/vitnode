import { useTranslations } from "use-intl";

import type { StandingSuspension } from "@/views/profile/warnings/standing";

import { Badge } from "@/components/ui/badge";

export const SuspensionStatusBadge = ({
  suspension,
}: {
  suspension: Pick<StandingSuspension, "active" | "lifted">;
}) => {
  const t = useTranslations("core.moderation.account_status");

  if (suspension.active) {
    return <Badge variant="destructive">{t("sanction_active")}</Badge>;
  }

  return suspension.lifted ? (
    <Badge variant="outline">{t("sanction_lifted")}</Badge>
  ) : (
    <Badge variant="secondary">{t("sanction_ended")}</Badge>
  );
};
