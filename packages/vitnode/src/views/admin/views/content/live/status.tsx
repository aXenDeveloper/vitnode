import { cn } from "cn";
import { useLocale, useTranslations } from "use-intl";

import { useContentLive } from "./context";

/**
 * "Saving…", "Draft saved at 14:32", "Unsaved changes": what autosave did with
 * this person's typing, announced politely. Renders nothing outside a live
 * form, so a layout can place it unconditionally.
 */
export const ContentLiveStatus = ({ className }: { className?: string }) => {
  const t = useTranslations("core.content.live.status");
  const locale = useLocale();
  const live = useContentLive();
  if (!live) return null;

  const { dirty, failed, savedAt, saving } = live.status;
  const saved = savedAt
    ? t("saved", {
        time: new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(
          new Date(savedAt),
        ),
      })
    : null;
  const message = saving ? t("saving") : failed ? t("failed") : saved;

  return (
    <p
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-2 text-sm leading-relaxed",
        className,
      )}
      role="status"
    >
      {message ? <span>{message}</span> : null}
      {dirty ? (
        <span className="text-foreground font-medium">{t("unsaved")}</span>
      ) : null}
    </p>
  );
};
