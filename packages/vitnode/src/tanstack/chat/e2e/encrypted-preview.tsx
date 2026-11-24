import React from "react";
import { useTranslations } from "use-intl";

import { decryptCached, peekDecrypted } from "./hooks";
import { e2eStore, useE2EStoreVersion } from "./store";

/**
 * The chat list's preview of an encrypted message: its text when this tab
 * already holds the chat's key (the chat was opened), a lock line otherwise.
 */
export const useEncryptedPreview = (
  chatId: number,
  body: null | string,
): string => {
  const t = useTranslations("core.global.chat.e2e");
  useE2EStoreVersion();
  const [, setTick] = React.useState(0);
  const key = e2eStore.anyChatKey(chatId);
  const value = body ? peekDecrypted(body) : undefined;

  React.useEffect(() => {
    if (!key || !body || value) return;
    let cancelled = false;
    void decryptCached(key, body).then(() => {
      if (!cancelled) setTick(tick => tick + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [body, key, value]);

  return value && value !== "error"
    ? value.t.replace(/\s+/gu, " ").slice(0, 100)
    : `🔒 ${t("encrypted_message")}`;
};
