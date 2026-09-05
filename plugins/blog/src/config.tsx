import { buildPlugin } from "@vitnode/core/lib/plugin";

import { adminContent } from "./admin/content";
import messages from "./locales";

export const blogPlugin = () =>
  buildPlugin({
    ...adminContent,
    messages,
  });
