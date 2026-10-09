import React from "react";

import { serializeLocaleCookie } from "@/lib/i18n/locale-cookie";
import { urlLocaleToRemember } from "@/lib/i18n/remembered-locale";

import { browserHostOf } from "./host";
import { getIntlRuntime } from "./runtime";

export const RememberUrlLocale = () => {
  React.useEffect(() => {
    const { cookie } = globalThis.document;
    const { location } = globalThis;
    const locale = urlLocaleToRemember({
      cookieHeader: cookie,
      host: browserHostOf(location),
      localeRouting: getIntlRuntime().localeRouting,
      pathname: location.pathname,
    });
    if (!locale) return;

    globalThis.document.cookie = serializeLocaleCookie(locale, {
      secure: location.protocol === "https:",
    });
  }, []);

  return null;
};
