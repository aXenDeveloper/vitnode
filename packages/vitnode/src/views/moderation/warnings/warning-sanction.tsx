import { useFormatter, useTranslations } from "use-intl";

import { WarningDuration } from "./warning-format";

/** The sanction a warning leads to, in words. */
export const SanctionSummary = ({
  sanction,
}: {
  sanction: { durationHours?: null | number; endsAt: Date | null | string };
}) => {
  const t = useTranslations("core.moderation.warn");
  const format = useFormatter();
  if (sanction.endsAt === null) return <>{t("sanction.indefinite")}</>;
  const endsAt = format.dateTime(new Date(sanction.endsAt), {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return sanction.durationHours ? (
    <>
      {t("sanction.for")} <WarningDuration hours={sanction.durationHours} />{" "}
      {t("sanction.until", { endsAt })}
    </>
  ) : (
    <>{t("sanction.suspended_until", { endsAt })}</>
  );
};
