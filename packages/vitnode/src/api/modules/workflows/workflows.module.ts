import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { workflowStepQueueTask } from "./tasks/workflow-step.task";

/**
 * Core's home for the Workflow Engine's runtime.
 *
 * Deliberately thin: the engine orchestrates over the existing queue, cron and
 * event systems rather than shipping its own, so the only thing core registers
 * is the single generic step task the runner is delivered through.
 */
export const workflowsModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "workflows",
  routes: [],
  queueTasks: [workflowStepQueueTask],
});
