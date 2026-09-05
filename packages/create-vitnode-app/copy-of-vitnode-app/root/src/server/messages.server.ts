import "@tanstack/react-start/server-only";
import { createIntlMessagesLoader } from "@vitnode/core/tanstack/i18n/server";

import { vitNodeServerConfig } from "#/vitnode.server.config";

export type { IntlMessages } from "@vitnode/core/tanstack/i18n/server";

export const loadIntlMessages = createIntlMessagesLoader(vitNodeServerConfig);
