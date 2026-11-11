import type { z } from "zod";

import { core_ai_runs } from "@/database/ai";
import { core_users } from "@/database/users";

import type { zodAiRunRow } from "../ai.schema";

export const runColumns = {
  accepted: core_ai_runs.accepted,
  actionKey: core_ai_runs.actionKey,
  actorType: core_ai_runs.actorType,
  chargedPoints: core_ai_runs.chargedPoints,
  chargedUsd: core_ai_runs.chargedUsd,
  costSource: core_ai_runs.costSource,
  costUsd: core_ai_runs.costUsd,
  createdAt: core_ai_runs.createdAt,
  errorCode: core_ai_runs.errorCode,
  finishedAt: core_ai_runs.finishedAt,
  id: core_ai_runs.id,
  inputTokens: core_ai_runs.inputTokens,
  modelId: core_ai_runs.modelId,
  outputTokens: core_ai_runs.outputTokens,
  provider: core_ai_runs.provider,
  resourceId: core_ai_runs.resourceId,
  resourceType: core_ai_runs.resourceType,
  status: core_ai_runs.status,
  userId: core_users.id,
  userName: core_users.name,
  userNameCode: core_users.nameCode,
};

export const toRow = ({
  userId,
  userName,
  userNameCode,
  ...run
}: Omit<z.infer<typeof zodAiRunRow>, "user"> & {
  userId: null | number;
  userName: null | string;
  userNameCode: null | string;
}) => ({
  ...run,
  user:
    userId === null
      ? null
      : { id: userId, name: userName ?? "", nameCode: userNameCode ?? "" },
});
