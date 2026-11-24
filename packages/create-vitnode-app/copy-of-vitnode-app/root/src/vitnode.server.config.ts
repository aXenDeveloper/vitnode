import "@tanstack/react-start/server-only";
import { buildServerConfig } from "@vitnode/core/vitnode.config";

import { appMessages } from "@/locales/app";
import { packageMessages } from "@/package-messages.gen";
import { vitNodeConfig } from "@/vitnode.config";

export const vitNodeServerConfig = buildServerConfig({
  config: vitNodeConfig,
  messages: appMessages,
  packageMessages,
  seo: {
    // Search engines may index the site only where this is "true". Set it for
    // the production build and server alike; previews stay `noindex`.
    indexing: process.env.VITNODE_SEO_INDEXING === "true",
    sitemap: { paths: ["/"] },
  },
});
