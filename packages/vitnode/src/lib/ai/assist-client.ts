import { fetcherClient } from "@/lib/fetcher-client";
import { manifest } from "@/manifest";

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
  | "unknown"
  | (typeof AI_CLIENT_ERROR_CODES)[number];

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

/**
 * The AI error code of a thrown value: the `code` of an `AiRequestError`
 * (what the AI client helpers throw), `"unknown"` for anything else. Use it in
 * a `catch` to pick the message to show.
 */
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

/**
 * Runs an AI action once from the AdminCP and resolves with its whole output.
 * Browser-only: it calls the `admin/ai` `/assist` route with the browser's
 * session, so the signed-in admin's AI permissions apply. Each call sends a
 * fresh idempotency key.
 *
 * @throws `AiRequestError` with the server's error code (`"unknown"` when the
 * body has none) and the HTTP status, for any non-2xx response.
 */
export const requestAiAssist = async ({
  action,
  input,
  signal,
  sourceFingerprint,
}: {
  /** The qualified action key, e.g. `"@vitnode/blog:excerpt.generate"`. */
  action: string;
  /** The action's input; validated on the server against the action's schema. */
  input: unknown;
  /** Aborts the request. */
  signal?: AbortSignal;
  /** Recorded with the run, e.g. a fingerprint of the source the output was made from. */
  sourceFingerprint?: string;
}): Promise<{ output: unknown; runId: number }> => {
  const response = await fetcherClient({
    plugin: manifest.id,
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
          plugin: manifest.id,
          args,
          method: "post",
          module: "admin/ai",
          path: "/assist/runs/{id}/feedback",
        })
      : fetcherClient({
          plugin: manifest.id,
          args,
          method: "post",
          module: "ai",
          path: "/runs/{id}/feedback",
        });
  await feedback.catch(() => undefined);
};
