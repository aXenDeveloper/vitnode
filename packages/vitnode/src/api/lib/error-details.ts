import { redactSecrets } from "@/api/lib/redact";

const DRIVER_FIELDS = [
  "code",
  "detail",
  "hint",
  "constraint",
  "table",
  "column",
  "position",
  "routine",
] as const;

const MAX_CAUSE_DEPTH = 5;

const QUERY_PARAMS = /^(Failed query: [\s\S]*?)\nparams: [\s\S]*$/;
const DETAIL_FAILING_ROW = /Failing row contains \([\s\S]*\)/;
const DETAIL_KEY_VALUES = /=\([\s\S]*\)/;

const redactMessage = (message: string): string =>
  redactSecrets(message.replace(QUERY_PARAMS, "$1\nparams: [redacted]"));

const redactDetail = (detail: string): string =>
  detail
    .replace(DETAIL_FAILING_ROW, "Failing row contains ([redacted])")
    .replace(DETAIL_KEY_VALUES, "=([redacted])");

const readDriverFields = (error: Error): string[] => {
  const fields = error as unknown as Record<string, unknown>;

  return DRIVER_FIELDS.flatMap(key => {
    const value = fields[key];

    if (typeof value === "string" && value.length > 0) {
      const safe = key === "detail" ? redactDetail(value) : value;

      return [`${key}: ${redactSecrets(safe)}`];
    }

    if (typeof value === "number") {
      return [`${key}: ${String(value)}`];
    }

    return [];
  });
};

const describeOne = (error: unknown): string => {
  if (error instanceof Error) {
    const fields = readDriverFields(error);
    const message =
      error.message.length > 0 ? redactMessage(error.message) : error.name;

    return fields.length > 0 ? `${message} (${fields.join(", ")})` : message;
  }

  if (typeof error === "string") {
    return redactMessage(error);
  }

  return redactMessage(String(error));
};

export const describeError = (error: unknown): string => {
  const seen = new Set<unknown>();
  const parts: string[] = [];
  let current: unknown = error;

  while (
    current !== null &&
    current !== undefined &&
    !seen.has(current) &&
    parts.length < MAX_CAUSE_DEPTH
  ) {
    seen.add(current);
    parts.push(describeOne(current));
    current = current instanceof Error ? current.cause : undefined;
  }

  const message = parts.filter(part => part.length > 0).join("\nCaused by: ");

  return message.length > 0 ? message : "Unknown error";
};
