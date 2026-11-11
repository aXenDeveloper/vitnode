import type { z } from "zod";

import type { ComponentUpdateState } from "@/api/lib/updates/status";

import type { componentUpdateSchema } from "../updates.schema";

export const iso = (date: Date | null): null | string =>
  date?.toISOString() ?? null;

export const serializeComponentUpdate = (
  state: ComponentUpdateState,
): z.infer<typeof componentUpdateSchema> => ({
  ...state,
  lastAttemptAt: iso(state.lastAttemptAt),
  lastSuccessAt: iso(state.lastSuccessAt),
});
