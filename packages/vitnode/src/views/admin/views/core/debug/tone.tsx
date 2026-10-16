import { cn } from "cn";
import {
  CircleCheckIcon,
  CircleMinusIcon,
  OctagonAlertIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";

import { Badge } from "@/components/ui/badge";
import { FEEDBACK_TONE_TEXT } from "@/components/ui/feedback-tone";

import type { DebugTone } from "./health/health";

export const TONE_TEXT: Record<DebugTone, string> = {
  critical: FEEDBACK_TONE_TEXT.destructive,
  off: "text-muted-foreground",
  ok: FEEDBACK_TONE_TEXT.success,
  warn: FEEDBACK_TONE_TEXT.warning,
};

export const TONE_SURFACE: Record<DebugTone, string> = {
  critical: "bg-destructive/10 dark:bg-destructive/20",
  off: "bg-muted",
  ok: "bg-success/10 dark:bg-success/20",
  warn: "bg-warn/10 dark:bg-warn/20",
};

const TONE_DOT: Record<DebugTone, string> = {
  critical: "bg-destructive",
  off: "bg-muted-foreground/40",
  ok: "bg-success",
  warn: "bg-warn",
};

const TONE_ICON = {
  critical: OctagonAlertIcon,
  off: CircleMinusIcon,
  ok: CircleCheckIcon,
  warn: TriangleAlertIcon,
} as const;

const TONE_BADGE = {
  critical: "destructive",
  off: "secondary",
  ok: "success",
  warn: "warning",
} as const;

export const ToneIcon = ({
  className,
  tone,
}: {
  className?: string;
  tone: DebugTone;
}) => {
  const t = useTranslations("admin.debug.tone");
  const Icon = TONE_ICON[tone];

  return (
    <Icon
      aria-label={t(tone)}
      className={cn("size-4 shrink-0", TONE_TEXT[tone], className)}
      role="img"
    />
  );
};

export const ToneDot = ({
  className,
  tone,
}: {
  className?: string;
  tone: DebugTone;
}) => (
  <span
    aria-hidden
    className={cn("size-2 shrink-0 rounded-full", TONE_DOT[tone], className)}
  />
);

export const ToneBadge = ({ tone }: { tone: DebugTone }) => {
  const t = useTranslations("admin.debug.tone");

  return <Badge variant={TONE_BADGE[tone]}>{t(tone)}</Badge>;
};
