import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellOffIcon, BellPlusIcon, BellRingIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { NotificationSubject } from "@/lib/notifications/types";
import type { NotificationSubscriptionState } from "@/views/notifications/notifications-actions";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { setNotificationSubscriptionInBrowser } from "@/views/notifications/notifications-actions";
import {
  notificationSubscriptionQueryOptions,
  notificationSubscriptionsQueryKey,
} from "@/views/notifications/notifications-query";

import { useSessionQuery } from "../auth/session-query";

/**
 * Follow and mute controls for one subject, for any plugin page:
 *
 * ```tsx
 * <FollowSubjectButton subject={{ type: "blog.category", id: category.id }} />
 * ```
 *
 * Following adds the user to audiences the plugin publishes with
 * `followersOf`; muting silences everything about the subject. The subject
 * type must be registered with `buildNotificationSubject`. Guests see nothing.
 */
export const FollowSubjectButton = ({
  canMute = true,
  subject,
}: {
  /** Hide the mute toggle, e.g. where a subject is only ever followed. */
  canMute?: boolean;
  subject: NotificationSubject;
}) => {
  const { data: session } = useSessionQuery();
  const userId = session?.user?.id;
  if (userId === undefined) return null;

  return (
    <SignedInFollowButton canMute={canMute} subject={subject} userId={userId} />
  );
};

const SignedInFollowButton = ({
  canMute,
  subject,
  userId,
}: {
  canMute: boolean;
  subject: NotificationSubject;
  userId: number;
}) => {
  const t = useTranslations("core.global.notifications.follow");
  const tErrors = useTranslations("core.global.errors");
  const queryClient = useQueryClient();
  const options = notificationSubscriptionQueryOptions({ subject, userId });
  const { data: state, isPending } = useQuery(options);
  const [isSaving, setIsSaving] = React.useState(false);

  const set = async (next: NotificationSubscriptionState) => {
    setIsSaving(true);
    try {
      const saved = await setNotificationSubscriptionInBrowser({
        state: next,
        subject,
      });
      queryClient.setQueryData(options.queryKey, saved);
      toast.success(
        next === "following"
          ? t("followed")
          : next === "muted"
            ? t("muted")
            : t("cleared"),
        { description: t(`${next}_desc`) },
      );
    } catch {
      toast.error(tErrors("title"), {
        description: tErrors("internal_server_error"),
      });
    } finally {
      setIsSaving(false);
      await queryClient.invalidateQueries({
        queryKey: notificationSubscriptionsQueryKey(userId),
        refetchType: "none",
      });
    }
  };

  const following = state === "following";
  const muted = state === "muted";
  const disabled = isPending || isSaving;

  return (
    <ButtonGroup>
      <Button
        aria-pressed={following}
        disabled={disabled}
        onClick={() => void set(following ? "none" : "following")}
        size="sm"
        variant={following ? "secondary" : "outline"}
      >
        {following ? <BellRingIcon /> : <BellPlusIcon />}
        {following ? t("following") : t("follow")}
      </Button>
      {canMute ? (
        <Button
          aria-label={muted ? t("unmute") : t("mute")}
          aria-pressed={muted}
          disabled={disabled}
          onClick={() => void set(muted ? "none" : "muted")}
          size="icon-sm"
          title={muted ? t("unmute") : t("mute")}
          variant={muted ? "secondary" : "outline"}
        >
          <BellOffIcon />
        </Button>
      ) : null}
    </ButtonGroup>
  );
};
