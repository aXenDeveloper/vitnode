export const AI_RUN_STATUS_LIST = [
  "reserved",
  "running",
  "succeeded",
  "failed",
  "canceled",
  "uncertain",
] as const;

export type AiRunStatusValue = (typeof AI_RUN_STATUS_LIST)[number];

export const isAiRunStatus = (value: string): value is AiRunStatusValue =>
  (AI_RUN_STATUS_LIST as readonly string[]).includes(value);

export const aiRunStatusVariant = (
  status: string,
): "destructive" | "outline" | "secondary" | "success" | "warning" => {
  switch (status) {
    case "canceled":
      return "outline";
    case "failed":
      return "destructive";
    case "succeeded":
      return "success";
    case "uncertain":
      return "warning";
    default:
      return "secondary";
  }
};
