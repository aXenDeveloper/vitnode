import { HTTPException } from "hono/http-exception";

import { zodPendingError } from "../pending.schema";

export const pendingFailure = (error: unknown) => {
  if (
    error instanceof HTTPException &&
    (error.status === 400 || error.status === 429)
  ) {
    const parsed = zodPendingError.shape.error.safeParse(error.message);
    if (parsed.success) return { error: parsed.data, status: error.status };
  }

  throw error;
};
