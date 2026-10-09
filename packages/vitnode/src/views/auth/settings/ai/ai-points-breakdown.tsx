import { cn } from "cn";
import { InfinityIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import {
  type AiActionTranslate,
  translateAiActionText,
} from "@/lib/ai/action-text";
import { formatAiPoints } from "@/lib/ai/format-points";
import { aiUsageBreakdown } from "@/lib/ai/usage-breakdown";

import type { AiUsage, AiUsageAction } from "./ai-usage-query";

const SEGMENT_TONES = [
  "bg-primary",
  "bg-primary/65",
  "bg-primary/40",
  "bg-primary/20",
] as const;

export const AiUnlimitedPointsSummary = ({ usage }: { usage: AiUsage }) => {
  const t = useTranslations("core.auth.settings.ai.points");
  const locale = useLocale();
  const format = useFormatter();

  return (
    <div className="flex w-full items-start gap-3">
      <span
        aria-hidden
        className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md"
      >
        <InfinityIcon className="size-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium">{t("unlimited")}</span>
        <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t("unlimited_desc", {
            date: format.dateTime(new Date(usage.resetsAt), {
              day: "numeric",
              month: "long",
            }),
          })}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-lg leading-none font-semibold tabular-nums">
          {formatAiPoints(usage.points.used, locale)}
        </span>
        <span className="text-muted-foreground text-xs">{t("this_month")}</span>
      </div>
    </div>
  );
};

export const AiPointsBreakdown = ({
  actions,
}: {
  actions: AiUsageAction[];
}) => {
  const t = useTranslations("core.auth.settings.ai.points.breakdown");
  const tAll = useTranslations() as unknown as AiActionTranslate;
  const locale = useLocale();
  const format = useFormatter();
  const segments = aiUsageBreakdown(actions).map((segment, index) => ({
    ...segment,
    key: segment.kind === "action" ? segment.action.key : "other",
    label:
      segment.kind === "action"
        ? translateAiActionText(tAll, segment.action.title)
        : t("other", { count: segment.count }),
    tone: SEGMENT_TONES[index],
  }));

  if (segments.length === 0) {
    return (
      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {t("empty")}
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div
        aria-hidden
        className="bg-muted flex h-2 w-full gap-0.5 overflow-hidden rounded-full"
      >
        {segments.map(segment => (
          <span
            className={cn("h-full min-w-1", segment.tone)}
            key={segment.key}
            style={{ flexGrow: segment.share * 100 }}
          />
        ))}
      </div>
      <ul aria-label={t("label")} className="flex flex-col gap-2">
        {segments.map(segment => (
          <li className="flex items-center gap-3 text-sm" key={segment.key}>
            <span
              aria-hidden
              className={cn("size-2 shrink-0 rounded-full", segment.tone)}
            />
            <span className="min-w-0 flex-1 truncate">{segment.label}</span>
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {t("points", {
                points: formatAiPoints(String(segment.points), locale),
              })}
            </span>
            <span className="w-10 shrink-0 text-end font-medium tabular-nums">
              {format.number(segment.share, {
                maximumFractionDigits: 0,
                style: "percent",
              })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
