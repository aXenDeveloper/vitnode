import { cn } from "cn";
import { useLocale, useTranslations } from "use-intl";

import { Badge } from "@/components/ui/badge";
import { formatAiUsd } from "@/lib/ai/format-points";
import { aiRunStatusVariant, isAiRunStatus } from "@/lib/ai/run-status";

export const AiActionLabel = ({
  actionKey,
  className,
  title,
}: {
  actionKey: string;
  className?: string;
  title?: null | string;
}) => (
  <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
    {title ? (
      <span className="text-foreground text-sm font-medium text-pretty">
        {title}
      </span>
    ) : null}
    <span
      className={cn(
        "truncate font-mono text-xs",
        title ? "text-muted-foreground" : "text-foreground",
      )}
      title={actionKey}
    >
      {actionKey}
    </span>
  </div>
);

export const AiUsd = ({
  className,
  value,
}: {
  className?: string;
  value: null | string | undefined;
}) => {
  const t = useTranslations("admin.ai.cost");
  const locale = useLocale();

  if (value === null || value === undefined) {
    return (
      <span className={cn("text-muted-foreground italic", className)}>
        {t("unknown")}
      </span>
    );
  }

  return (
    <span className={cn("tabular-nums", className)}>
      {formatAiUsd(value, locale)}
    </span>
  );
};

const COST_SOURCE_KEYS = {
  mixed: "mixed",
  pricing: "estimated",
  provider: "provider",
  unknown: "unknown",
} as const;

export const AiCostSourceBadge = ({ source }: { source: null | string }) => {
  const t = useTranslations("admin.ai.cost.source");
  const key =
    source && source in COST_SOURCE_KEYS
      ? COST_SOURCE_KEYS[source as keyof typeof COST_SOURCE_KEYS]
      : "unknown";

  return (
    <Badge
      variant={
        key === "provider"
          ? "success"
          : key === "unknown"
            ? "warning"
            : "outline"
      }
    >
      {t(key)}
    </Badge>
  );
};

export const AiRunStatusBadge = ({ status }: { status: string }) => {
  const t = useTranslations("admin.ai.status");

  return (
    <Badge variant={aiRunStatusVariant(status)}>
      {isAiRunStatus(status) ? t(status) : status}
    </Badge>
  );
};
