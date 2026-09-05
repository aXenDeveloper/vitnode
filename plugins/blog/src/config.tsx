import { buildPlugin } from "@vitnode/core/lib/plugin";

import { CONFIG_PLUGIN } from "@/const";

import messages from "./locales";

export const blogPlugin = () =>
  buildPlugin({
    ...CONFIG_PLUGIN,
    messages,
  });
