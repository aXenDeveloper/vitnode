import { cn } from "cn";
import { SparklesIcon } from "lucide-react";
import { useLocale, useTranslations } from "use-intl";

import { Badge } from "@/components/ui/badge";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import { formatAiUsd } from "@/lib/ai/format-points";
import { aiRunStatusVariant, isAiRunStatus } from "@/lib/ai/run-status";

/** An action as people read it: its title, then its key for the record. */
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

/**
 * A USD amount, or "Unknown" - an unknown cost must never read as `$0.00`.
 */
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

/** Where a cost came from: the provider's own bill, our price table, or nowhere. */
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

/** `0.983` as `98%` in the reader's locale. */
export const formatAiShare = (share: number, locale: string): string =>
  new Intl.NumberFormat(locale, {
    maximumFractionDigits: share > 0 && share < 0.01 ? 1 : 0,
    style: "percent",
  }).format(share);

export const AiActionIcon = ({
  enabled,
  icon,
}: {
  enabled: boolean;
  icon: null | string;
}) => (
  <span
    aria-hidden
    className={cn(
      "flex size-9 shrink-0 items-center justify-center rounded-md transition-colors",
      enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
    )}
  >
    {icon ? (
      <DynamicIcon
        className="size-4"
        fallback={<SparklesIcon className="size-4" />}
        name={icon}
      />
    ) : (
      <SparklesIcon className="size-4" />
    )}
  </span>
);
