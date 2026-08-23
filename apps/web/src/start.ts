import { createStart } from "@tanstack/react-start";
import { localeRequestMiddleware } from "@vitnode/i18n/server";

export const startInstance = createStart(() => ({
  requestMiddleware: [localeRequestMiddleware],
}));
