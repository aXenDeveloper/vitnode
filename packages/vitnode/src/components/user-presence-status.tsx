import { cn } from "cn";
import { EyeOffIcon } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "use-intl";

import type { UserPresence } from "@/lib/user-presence";

export type PresenceVariant = "compact" | "dot" | "full";

const PresenceDot = ({
  className,
  online,
}: {
  className?: string;
  online: boolean;
}) => (
  <span
    aria-hidden="true"
    className={cn(
      "inline-block size-2.5 shrink-0 rounded-full",
      online ? "bg-success" : "bg-muted-foreground/40",
      className,
    )}
    data-slot="presence-dot"
  />
);

/**
 * How a member's presence reads: a dot beside an avatar, a short
 * Online / Offline label, or the full "Last seen 5 minutes ago". Rendering
 * only - fetch with `userPresenceQueryOptions` and let the API decide what the
 * viewer may see.
 */
export const UserPresenceStatus = ({
  className,
  presence,
  variant = "compact",
}: {
  className?: string;
  presence: UserPresence;
  variant?: PresenceVariant;
}) => {
  const t = useTranslations("core.global.presence");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });

  if (presence.status === "hidden") {
    const label = t("hidden");

    if (variant === "dot") return null;

    return (
      <span
        className={cn(
          "text-muted-foreground inline-flex items-center gap-1.5 text-sm",
          className,
        )}
        data-status="hidden"
      >
        <EyeOffIcon aria-hidden="true" className="size-3.5 shrink-0" />
        {label}
      </span>
    );
  }

  const online = presence.status === "online";
  const lastSeenAt = presence.lastSeenAt ? new Date(presence.lastSeenAt) : null;

  let label = t(online ? "online" : "offline");
  if (variant === "full") {
    if (online) {
      label = t("online_now");
    } else if (lastSeenAt) {
      label = t("last_seen", {
        time: format.relativeTime(lastSeenAt, now),
      });
    }
  }

  if (variant === "dot") {
    return (
      <span
        aria-label={label}
        className={cn("inline-flex", className)}
        data-status={presence.status}
        role="img"
      >
        <PresenceDot online={online} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "text-muted-foreground inline-flex items-center gap-1.5 text-sm",
        className,
      )}
      data-status={presence.status}
    >
      <PresenceDot online={online} />
      {variant === "full" && lastSeenAt && !online ? (
        <time dateTime={lastSeenAt.toISOString()}>{label}</time>
      ) : (
        label
      )}
    </span>
  );
};
