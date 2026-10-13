import {
  BellIcon,
  InboxIcon,
  type LucideIcon,
  MailIcon,
  SmartphoneIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Frame,
  FrameFooter,
  FrameHeader,
  FrameTitle,
} from "@/components/ui/frame";
import { ItemMedia } from "@/components/ui/item";
import { Switch } from "@/components/ui/switch";

import type { EmailChannelState } from "./email-channel";

type PushPermission = "default" | "denied" | "granted" | "unsupported";

type StatusVariant = React.ComponentProps<typeof Badge>["variant"];

const PUSH_STATUS = {
  default: { key: "off", variant: "secondary" },
  denied: { key: "blocked", variant: "warning" },
  granted: { key: "on", variant: "success" },
  unsupported: { key: "unsupported", variant: "outline" },
} as const satisfies Record<
  PushPermission,
  { key: string; variant: StatusVariant }
>;

const EMAIL_STATUS = {
  off: { key: "off", variant: "secondary" },
  on: { key: "on", variant: "success" },
  unavailable: { key: "unavailable", variant: "outline" },
} as const satisfies Record<
  EmailChannelState,
  { key: string; variant: StatusVariant }
>;

const readPushPermission = (): PushPermission =>
  "Notification" in window ? Notification.permission : "unsupported";

const permissionListeners = new Set<() => void>();

const subscribeToPermission = (listener: () => void) => {
  permissionListeners.add(listener);

  return () => {
    permissionListeners.delete(listener);
  };
};

const requestPushPermission = async (): Promise<PushPermission> => {
  const next = await Notification.requestPermission();
  permissionListeners.forEach(listener => {
    listener();
  });

  return next;
};

const ChannelCard = ({
  children,
  control,
  Icon,
  status,
  title,
}: {
  children: React.ReactNode;
  control?: React.ReactNode;
  Icon: LucideIcon;
  status: React.ReactNode;
  title: string;
}) => (
  <li className="bg-card ring-foreground/10 flex flex-col gap-3 rounded-md p-4 shadow-xs ring-1">
    <div className="flex items-start justify-between gap-3">
      <ItemMedia aria-hidden variant="tile">
        <Icon />
      </ItemMedia>
      {status}
    </div>
    <div className="flex flex-1 flex-col gap-1">
      <h3 className="text-foreground text-sm font-medium">{title}</h3>
      <div className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {children}
      </div>
    </div>
    {control ? <div className="flex items-center gap-2">{control}</div> : null}
  </li>
);

const PushCard = () => {
  const t = useTranslations("core.auth.settings.notifications.channels");
  const permission = React.useSyncExternalStore<null | PushPermission>(
    subscribeToPermission,
    readPushPermission,
    () => null,
  );
  const [isAsking, setIsAsking] = React.useState(false);
  const status = permission ? PUSH_STATUS[permission] : null;

  return (
    <ChannelCard
      control={
        permission === "default" ? (
          <Button
            aria-label={t("push.enable")}
            isLoading={isAsking}
            onClick={() => {
              setIsAsking(true);
              void requestPushPermission().then(next => {
                setIsAsking(false);
                if (next === "granted") {
                  toast.success(t("push.enabled_toast"), {
                    description: t("push.enabled_toast_desc"),
                  });
                }
              });
            }}
            size="sm"
            variant="outline"
          >
            <BellIcon aria-hidden />
            {t("push.enable_short")}
          </Button>
        ) : null
      }
      Icon={SmartphoneIcon}
      status={
        status ? (
          <Badge variant={status.variant}>{t(`status.${status.key}`)}</Badge>
        ) : null
      }
      title={t("push.title")}
    >
      {permission === "denied" || permission === "unsupported"
        ? t(`push.${permission}`)
        : t("push.desc")}
    </ChannelCard>
  );
};

export const NotificationChannelsGroup = ({
  email,
  emailState,
  onEmailChange,
}: {
  email: string;
  emailState: EmailChannelState;
  onEmailChange: (on: boolean) => void;
}) => {
  const t = useTranslations("core.auth.settings.notifications");
  const titleId = React.useId();
  const emailSwitchId = React.useId();
  const emailSwitchRef = React.useRef<HTMLButtonElement>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const emailStatus = EMAIL_STATUS[emailState];

  return (
    <Frame aria-labelledby={titleId} render={<section />}>
      <FrameHeader>
        <FrameTitle id={titleId} render={<h2 />}>
          {t("channels.title")}
        </FrameTitle>
      </FrameHeader>
      <ul className="grid gap-1 lg:grid-cols-3">
        <ChannelCard
          Icon={InboxIcon}
          status={
            <Badge variant="success">{t("channels.status.always_on")}</Badge>
          }
          title={t("channels.list.title")}
        >
          {t("channels.list.desc")}
        </ChannelCard>

        <PushCard />

        <ChannelCard
          control={
            emailState === "unavailable" ? null : (
              <label
                className="flex cursor-pointer items-center gap-2 text-sm"
                htmlFor={emailSwitchId}
              >
                <Switch
                  checked={emailState === "on"}
                  id={emailSwitchId}
                  onCheckedChange={on => {
                    if (on) onEmailChange(true);
                    else setConfirmOpen(true);
                  }}
                  ref={emailSwitchRef}
                />
                {t("channels.email.send")}
              </label>
            )
          }
          Icon={MailIcon}
          status={
            <Badge variant={emailStatus.variant}>
              {t(`channels.status.${emailStatus.key}`)}
            </Badge>
          }
          title={t("channels.email.title")}
        >
          {emailState === "unavailable" ? (
            t("channels.email.unavailable")
          ) : (
            <>
              {emailState === "on"
                ? t("channels.email.sent_to")
                : t("channels.email.off_to")}
              <span
                className="text-foreground block truncate font-medium"
                title={email}
              >
                {email}
              </span>
            </>
          )}
        </ChannelCard>
      </ul>
      <FrameFooter>{t("channels.push.soon")}</FrameFooter>

      <AlertDialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <AlertDialogContent finalFocus={emailSwitchRef}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("channels.email.stop_title")}
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed text-pretty">
              {t("channels.email.stop_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              onClick={() => {
                setConfirmOpen(false);
              }}
              variant="outline"
            >
              {t("channels.email.stop_cancel")}
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                onEmailChange(false);
              }}
              variant="destructive"
            >
              {t("channels.email.stop_submit")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Frame>
  );
};
