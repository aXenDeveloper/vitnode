import { cn } from "cn";
import { useFormatter, useNow, useTranslations } from "use-intl";

import { useContentLive } from "./context";

const SAVED_JUST_NOW_MS = 60_000;
const SAVED_TICK_MS = 15_000;

const SavedAt = ({ savedAt }: { savedAt: string }) => {
  const t = useTranslations("core.content.live.status");
  const format = useFormatter();
  const now = useNow({ updateInterval: SAVED_TICK_MS });
  const date = new Date(savedAt);
  const exact = format.dateTime(date, { timeStyle: "short" });
  const relative =
    now.getTime() - date.getTime() < SAVED_JUST_NOW_MS
      ? t("saved_just_now")
      : t("saved", { time: format.relativeTime(date, now) });

  return (
    <>
      <time
        aria-hidden
        dateTime={savedAt}
        suppressHydrationWarning
        title={exact}
      >
        {relative}
      </time>
      <span className="sr-only">{t("saved_at", { time: exact })}</span>
    </>
  );
};

/**
 * "Saving…", "Draft saved 3 minutes ago", "Unsaved changes": what autosave did
 * with this person's typing, announced politely. Renders nothing outside a
 * live form, so a layout can place it unconditionally.
 */
export const ContentLiveStatus = ({ className }: { className?: string }) => {
  const t = useTranslations("core.content.live.status");
  const live = useContentLive();
  if (!live) return null;

  const { dirty, failed, savedAt, saving } = live.status;
  const message = saving ? (
    t("saving")
  ) : failed ? (
    t("failed")
  ) : savedAt ? (
    <SavedAt savedAt={savedAt} />
  ) : null;

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
