import type { ChatSystemEvent } from "@vitnode/api/lib/chat/const";

import React from "react";
import { useTranslations } from "use-intl";

/** Words a system message ("Anna left") in the viewer's language. */
export const useSystemLine = (
  names: ReadonlyMap<number, string> = new Map(),
) => {
  const t = useTranslations("core.global.chat.system");

  return React.useCallback(
    (event: ChatSystemEvent, actorId: null | number): string => {
      const name = (id: null | number) =>
        (id === null ? undefined : names.get(id)) ?? t("someone");
      switch (event.type) {
        case "created":
          return t("created", { name: name(actorId) });
        case "joined":
          return t("joined", {
            count: event.userIds.length,
            name: name(actorId),
            names: event.userIds.map(id => name(id)).join(", "),
          });
        case "left":
          return t("left", { name: name(actorId) });
        case "removed":
          return t("removed", {
            name: name(actorId),
            target: name(event.userId),
          });
        case "renamed":
          return event.title
            ? t("renamed", { name: name(actorId), title: event.title })
            : t("renamed_cleared", { name: name(actorId) });
      }
    },
    [names, t],
  );
};
