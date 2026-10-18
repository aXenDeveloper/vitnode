import type { Context } from "hono";

import {
  DEFAULT_AI_MODEL_CAPABILITIES,
  missingCapabilities,
} from "./capabilities";

export const availableAiActions = async (
  c: Context,
  userId: number,
): Promise<string[]> => {
  const ai = c.get("ai");
  const ledger = ai.ledger();
  const settings = await ledger.loadSettings();
  if (!settings.enabled) return [];
  const models = c.get("core").ai?.models ?? [];

  const runnableActions = ai
    .actions()
    .all()
    .filter(
      action =>
        action.definition.actors.includes("user") &&
        models.some(
          model =>
            missingCapabilities(
              action.definition.requiredCapabilities,
              model.capabilities ?? DEFAULT_AI_MODEL_CAPABILITIES,
            ).length === 0,
        ),
    );

  const permissionDefaults = new Map<string, boolean>();
  for (const action of runnableActions) {
    if (!permissionDefaults.has(action.permissionKey)) {
      permissionDefaults.set(
        action.permissionKey,
        action.definition.permission.defaultGranted,
      );
    }
  }
  const [policies, actionSettings] = await Promise.all([
    ledger.resolveUserPolicies({
      permissions: [...permissionDefaults].map(
        ([permissionKey, defaultGranted]) => ({
          defaultGranted,
          permissionKey,
        }),
      ),
      settings,
      userId,
    }),
    ledger.loadActionSettingsMany(runnableActions.map(action => action.key)),
  ]);

  return runnableActions
    .filter(
      action =>
        actionSettings.get(action.key)?.enabled !== false &&
        policies.get(action.permissionKey)?.granted === true,
    )
    .map(action => action.key);
};
