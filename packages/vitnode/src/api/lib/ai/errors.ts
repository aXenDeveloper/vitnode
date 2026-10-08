import type { ContentfulStatusCode } from "hono/utils/http-status";

import { HTTPException } from "hono/http-exception";

export const AI_ERROR_STATUS = {
  AI_NOT_CONFIGURED: 400,
  AI_INVALID_INPUT: 400,
  AI_INPUT_TOO_LARGE: 413,
  AI_DISABLED: 503,
  AI_ACTION_DISABLED: 403,
  AI_ACTION_UNKNOWN: 404,
  AI_UNAUTHORIZED: 403,
  AI_MODEL_INCOMPATIBLE: 409,
  AI_PRICING_MISSING: 409,
  AI_USER_LIMIT_REACHED: 429,
  AI_DAILY_LIMIT_REACHED: 429,
  AI_RATE_LIMITED: 429,
  AI_CONCURRENCY_LIMITED: 429,
  AI_BUDGET_EXHAUSTED: 503,
  AI_DUPLICATE_REQUEST: 409,
  AI_PROVIDER_FAILED: 502,
  AI_INVALID_OUTPUT: 502,
  AI_TIMEOUT: 504,
  AI_CANCELED: 408,
} as const satisfies Record<string, number>;

export type AiErrorCode = keyof typeof AI_ERROR_STATUS;

export const AI_ERROR_CODES = Object.keys(AI_ERROR_STATUS) as AiErrorCode[];

export interface AiErrorBody {
  code: AiErrorCode;
  message: string;
  resetsAt?: string;
  runId?: number;
}

export class AiError extends HTTPException {
  constructor(
    code: AiErrorCode,
    message: string,
    extra: Pick<AiErrorBody, "resetsAt" | "runId"> = {},
  ) {
    const status = AI_ERROR_STATUS[code] as ContentfulStatusCode;
    const body: AiErrorBody = { code, message, ...extra };
    super(status, {
      message,
      res: Response.json(body, { status }),
    });
    this.code = code;
    this.body = body;
  }

  readonly body: AiErrorBody;
  readonly code: AiErrorCode;
}

export const isAiError = (error: unknown): error is AiError =>
  error instanceof AiError;
