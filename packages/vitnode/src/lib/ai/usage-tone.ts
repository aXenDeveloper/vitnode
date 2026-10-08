export const AI_USAGE_WARNING_SHARE = 0.8;
export const AI_USAGE_CRITICAL_SHARE = 0.9;

export type AiUsageTone = "critical" | "normal" | "warning";

export const aiUsageTone = (share: number): AiUsageTone => {
  if (share >= AI_USAGE_CRITICAL_SHARE) return "critical";
  if (share >= AI_USAGE_WARNING_SHARE) return "warning";

  return "normal";
};

export const AI_USAGE_TONE_BAR: Record<AiUsageTone, string> = {
  critical: "bg-destructive",
  normal: "bg-primary",
  warning: "bg-warn",
};
