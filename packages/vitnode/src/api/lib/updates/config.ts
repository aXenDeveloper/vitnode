import type { VitNodeApiConfig } from "@/vitnode.config";

import { UPDATE_CHANNELS, type UpdateChannel } from "@/lib/updates/manifest";

export interface ResolvedUpdatesConfig {
  channelOverride: null | UpdateChannel;
  enabled: boolean;
}

export const resolveUpdatesConfig = (
  updates: VitNodeApiConfig["updates"],
): ResolvedUpdatesConfig => {
  const channel = updates?.channel;
  if (channel !== undefined && !UPDATE_CHANNELS.includes(channel)) {
    throw new Error(
      `[VitNode updates] \`updates.channel\` is ${JSON.stringify(channel)}. Use one of: ${UPDATE_CHANNELS.join(", ")}.`,
    );
  }

  return {
    channelOverride: channel ?? null,
    enabled: updates?.enabled ?? true,
  };
};
