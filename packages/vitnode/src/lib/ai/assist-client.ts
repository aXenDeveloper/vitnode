import { CONFIG_PLUGIN } from "@/config";
import { fetcherClient } from "@/lib/fetcher-client";

export const AI_CLIENT_ERROR_CODES = [
  "AI_ACTION_DISABLED",
  "AI_BUDGET_EXHAUSTED",
  "AI_CANCELED",
  "AI_CONCURRENCY_LIMITED",
  "AI_DAILY_LIMIT_REACHED",
  "AI_DISABLED",
  "AI_DUPLICATE_REQUEST",
  "AI_INPUT_TOO_LARGE",
  "AI_INVALID_INPUT",
  "AI_INVALID_OUTPUT",
  "AI_MODEL_INCOMPATIBLE",
  "AI_NOT_CONFIGURED",
  "AI_PRICING_MISSING",
  "AI_PROVIDER_FAILED",
  "AI_RATE_LIMITED",
  "AI_TIMEOUT",
  "AI_UNAUTHORIZED",
  "AI_USER_LIMIT_REACHED",
] as const;

export type AiClientErrorCode =
  "unknown" | (typeof AI_CLIENT_ERROR_CODES)[number];

export class AiRequestError extends Error {
  constructor(code: AiClientErrorCode, status: number) {
    super(code);
    this.name = "AiRequestError";
    this.code = code;
    this.status = status;
  }

  readonly code: AiClientErrorCode;
  readonly status: number;
}

export const aiErrorCodeOf = (error: unknown): AiClientErrorCode =>
  error instanceof AiRequestError ? error.code : "unknown";

export const toAiClientErrorCode = (value: unknown): AiClientErrorCode =>
  typeof value === "string" &&
  (AI_CLIENT_ERROR_CODES as readonly string[]).includes(value)
    ? (value as AiClientErrorCode)
    : "unknown";

export const readAiErrorCode = async (
  response: Response,
): Promise<AiClientErrorCode> => {
  try {
    const body = (await response.json()) as { code?: unknown };

    return toAiClientErrorCode(body.code);
  } catch {
    return "unknown";
  }
};

export const requestAiAssist = async ({
  action,
  input,
  signal,
  sourceFingerprint,
}: {
  action: string;
  input: unknown;
  signal?: AbortSignal;
  sourceFingerprint?: string;
}): Promise<{ output: unknown; runId: number }> => {
  const response = await fetcherClient({
    plugin: CONFIG_PLUGIN.pluginId,
    args: {
      body: {
        action,
        idempotencyKey: crypto.randomUUID(),
        input,
        sourceFingerprint,
      },
    },
    method: "post",
    module: "admin/ai",
    options: { signal },
    path: "/assist",
  });
  if (!response.ok) {
    throw new AiRequestError(await readAiErrorCode(response), response.status);
  }
  const { output, runId } = await response.json();

  return { output, runId };
};

export const sendAiFeedback = async ({
  accepted,
  runId,
  scope = "admin",
}: {
  accepted: boolean;
  runId: number;
  scope?: "admin" | "user";
}): Promise<void> => {
  const args = { body: { accepted }, params: { id: runId } };
  const feedback =
    scope === "admin"
      ? fetcherClient({
          plugin: CONFIG_PLUGIN.pluginId,
          args,
          method: "post",
          module: "admin/ai",
          path: "/assist/runs/{id}/feedback",
        })
      : fetcherClient({
          plugin: CONFIG_PLUGIN.pluginId,
          args,
          method: "post",
          module: "ai",
          path: "/runs/{id}/feedback",
        });
  await feedback.catch(() => undefined);
};
