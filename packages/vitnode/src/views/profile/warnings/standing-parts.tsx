import { cn } from "cn";
import { ShieldBanIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { FEEDBACK_TONE_TEXT } from "@/components/ui/feedback-tone";
import { resolveReasonText } from "@/views/moderation/report-reasons-query";
import { WarningDuration } from "@/views/moderation/warnings/warning-format";

import type { StandingSuspension, StandingWarning } from "./standing";

import { suspensionHours } from "./standing";

type NodeSize = "lg" | "md" | "sm";

const NODE_SIZE: Record<NodeSize, string> = {
  lg: "size-12 text-lg",
  md: "size-10 text-base",
  sm: "size-8 text-sm",
};

const ICON_SIZE: Record<NodeSize, string> = {
  lg: "size-6",
  md: "size-5",
  sm: "size-4",
};

export const WarningNode = ({
  size = "md",
  warning,
}: {
  size?: NodeSize;
  warning: Pick<StandingWarning, "points" | "status">;
}) => (
  <span
    aria-hidden="true"
    className={cn(
      "flex shrink-0 items-center justify-center rounded-full font-semibold tabular-nums",
      NODE_SIZE[size],
      warning.status === "active" && ["bg-warn/15", FEEDBACK_TONE_TEXT.warning],
      warning.status === "expired" && "bg-muted text-muted-foreground",
      warning.status === "revoked" &&
        "border-muted-foreground/50 text-muted-foreground border border-dashed line-through",
    )}
  >
    {warning.points}
  </span>
);

export const SuspensionNode = ({
  active,
  size = "md",
}: {
  active: boolean;
  size?: NodeSize;
}) => (
  <span
    aria-hidden="true"
    className={cn(
      "flex shrink-0 items-center justify-center rounded-full",
      NODE_SIZE[size],
      active
        ? ["bg-destructive/15", FEEDBACK_TONE_TEXT.destructive]
        : "bg-muted text-muted-foreground",
    )}
  >
    <ShieldBanIcon className={ICON_SIZE[size]} />
  </span>
);

export const reasonTextOf = (
  warning: Pick<StandingWarning, "reason">,
  locale: string,
  fallback: string,
) => (warning.reason ? resolveReasonText(warning.reason, locale) : fallback);

export const SuspensionTitle = ({
  suspension,
}: {
  suspension: StandingSuspension;
}) => {
  const t = useTranslations("core.moderation.warn.sanctions");

  return <>{suspension.endsAt ? t("temporary") : t("indefinite")}</>;
};

export const SuspensionLength = ({
  suspension,
}: {
  suspension: StandingSuspension;
}) => {
  const hours = suspensionHours(suspension);
  if (hours === null) return null;

  return <WarningDuration hours={hours} />;
};
