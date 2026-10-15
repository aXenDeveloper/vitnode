import type { Context } from "hono";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";

import { runLockedUpdateCheck } from "./check";

/** The check as the cron job and the AdminCP button both run it: same lease, same service. */
export const runUpdateCheckFor = async (
  c: Context<EnvVitNode>,
  { manual }: { manual: boolean },
) => {
  const { channelOverride, components, coreVersion } = c.get("core").updates;

  return await runLockedUpdateCheck({
    channelOverride,
    components,
    coreVersion,
    db: c.get("db"),
    manual,
  });
};
