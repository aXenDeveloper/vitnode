import type { Context } from "hono";

import type { EnvVitNode } from "../../middlewares/global.middleware";
import type { ContentEventAction } from "../events";
import type { ContentId } from "../ids";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentPublicState } from "./page-cache";

import { runAfterResponse } from "../../lib/after-response";
import { queueRecordAutoTranslations } from "../../lib/content-translation/service";
import { contentIdKey } from "../ids";

const TRANSLATING_ACTIONS: ReadonlySet<ContentEventAction> = new Set([
  "created",
  "published",
  "unhidden",
  "updated",
]);

const translatedFieldsChanged = (
  fields: readonly string[],
  action: ContentEventAction,
  payload: object,
): boolean => {
  if (action !== "updated") return true;
  if (!("changedFields" in payload) || !Array.isArray(payload.changedFields)) {
    return true;
  }

  return (payload.changedFields as unknown[]).some(
    field => typeof field === "string" && fields.includes(field),
  );
};

export const queueContentAutoTranslations = (
  c: Context,
  {
    action,
    contentId,
    definition,
    payload,
    publicState,
  }: {
    action: ContentEventAction;
    contentId: ContentId;
    definition: AnyContentTypeDefinition;
    payload: object;
    publicState?: ContentPublicState;
  },
): void => {
  if (!definition.autoTranslate.enabled) return;
  if (!TRANSLATING_ACTIONS.has(action)) return;
  if (publicState && !publicState.isPublic) return;
  const fields = definition.autoTranslate.fields.map(field => field.name);
  if (!translatedFieldsChanged(fields, action, payload)) return;

  runAfterResponse(
    c,
    queueRecordAutoTranslations(c as Context<EnvVitNode>, {
      contentTypeId: definition.id,
      fields,
      ids: [contentIdKey(contentId)],
    }).catch(async (error: unknown) => {
      await c
        .get("log")
        ?.warn(
          `[Content translation] ${definition.id}: translations of a written record were not queued (${error instanceof Error ? error.message : String(error)}). Readers queue them on demand.`,
        );
    }),
  );
};
