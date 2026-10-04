import type { Context } from "hono";

import {
  DEFAULT_AI_MODEL_CAPABILITIES,
  missingCapabilities,
} from "./capabilities";

/**
 * The AI actions the signed-in person may start right now: the action is
 * enabled, a configured model can run it, and their roles grant its
 * permission. Content access is still checked per run - this only decides
 * which buttons to show.
 */
export const availableAiActions = async (
  c: Context,
  userId: number,
): Promise<string[]> => {
  const ai = c.get("ai");
  const ledger = ai.ledger();
  const settings = await ledger.loadSettings();
  if (!settings.enabled) return [];
  const models = c.get("core").ai?.models ?? [];

  const available: string[] = [];
  const policies = new Map<string, boolean>();
  for (const action of ai.actions().all()) {
    if (!action.definition.actors.includes("user")) continue;
    const runnable = models.some(
      model =>
        missingCapabilities(
          action.definition.requiredCapabilities,
          model.capabilities ?? DEFAULT_AI_MODEL_CAPABILITIES,
        ).length === 0,
    );
    if (!runnable) continue;
    const actionSettings = await ledger.loadActionSettings(action.key);
    if (actionSettings?.enabled === false) continue;

    let granted = policies.get(action.permissionKey);
    if (granted === undefined) {
      granted = (
        await ledger.resolveUserPolicy({
          defaultGranted: action.definition.permission.defaultGranted,
          permissionKey: action.permissionKey,
          userId,
        })
      ).granted;
      policies.set(action.permissionKey, granted);
    }
    if (granted) available.push(action.key);
  }

  return available;
};
