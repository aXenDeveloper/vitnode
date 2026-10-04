import { z } from "zod";

/** What a browser may send to run an action. Never a model, price or actor. */
export const zodAiRunBody = z.object({
  action: z.string().min(3).max(255),
  /** Retries of one user gesture reuse the key, so they never charge twice. */
  idempotencyKey: z.string().min(8).max(128).optional(),
  input: z.unknown(),
  /** Recorded with the run; access is still decided by the action's authorize(). */
  resource: z
    .object({
      id: z.union([z.string().max(255), z.number()]).nullable(),
      type: z.string().min(1).max(100),
    })
    .optional(),
  sourceFingerprint: z.string().min(1).max(64).optional(),
});

export const zodAiRunResponse = z.object({
  output: z.unknown(),
  runId: z.number(),
  usage: z.object({
    chargedPoints: z.string(),
    costKnown: z.boolean(),
    modelId: z.string(),
  }),
});

export const zodAiErrorBody = z.object({
  code: z.string(),
  message: z.string(),
  resetsAt: z.string().optional(),
  runId: z.number().optional(),
});
