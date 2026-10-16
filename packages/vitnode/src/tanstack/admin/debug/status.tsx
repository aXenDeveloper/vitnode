import { cn } from "cn";
import { OctagonAlertIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { FEEDBACK_TONE_TEXT } from "@/components/ui/feedback-tone";
import { debugHealth } from "@/views/admin/views/core/debug/health/health";

import { useDebugSources } from "./query";

export const DebugStatus = () => {
  const t = useTranslations("admin.global.nav.user_bar");
  const { issues } = debugHealth(useDebugSources());
  if (issues.length === 0) return null;

  const critical = issues.some(issue => issue.tone === "critical");
  const Icon = critical ? OctagonAlertIcon : TriangleAlertIcon;

  return (
    <Icon
      aria-label={t("debug_status", { count: issues.length })}
      className={cn(
        "ms-auto size-4",
        critical ? FEEDBACK_TONE_TEXT.destructive : FEEDBACK_TONE_TEXT.warning,
      )}
      role="img"
    />
  );
};
