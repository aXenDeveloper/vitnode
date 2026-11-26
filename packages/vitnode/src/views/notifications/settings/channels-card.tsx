import {
  BellIcon,
  InboxIcon,
  type LucideIcon,
  MailIcon,
  MailXIcon,
  SmartphoneIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Frame,
  FrameHeader,
  FramePanel,
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

const ChannelRow = ({
  children,
  control,
  Icon,
  labelFor,
  title,
}: {
  children: React.ReactNode;
  control: React.ReactNode;
  Icon: LucideIcon;
  labelFor?: string;
  title: string;
}) => (
  <li className="flex items-center gap-4 px-4 py-3.5">
    <ItemMedia aria-hidden variant="tile">
      <Icon />
    </ItemMedia>
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      {labelFor ? (
        <label
          className="text-foreground w-fit cursor-pointer text-sm font-medium"
          htmlFor={labelFor}
        >
          {title}
        </label>
      ) : (
        <h3 className="text-foreground text-sm font-medium">{title}</h3>
      )}
      <div className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {children}
      </div>
    </div>
    <div className="flex shrink-0 items-center">{control}</div>
  </li>
);

const PushRow = () => {
  const t = useTranslations("core.auth.settings.notifications.channels");
  const permission = React.useSyncExternalStore<null | PushPermission>(
    subscribeToPermission,
    readPushPermission,
    () => null,
  );
  const [isAsking, setIsAsking] = React.useState(false);
  const status = permission ? PUSH_STATUS[permission] : null;

  return (
    <ChannelRow
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
        ) : status ? (
          <Badge variant={status.variant}>{t(`status.${status.key}`)}</Badge>
        ) : null
      }
      Icon={SmartphoneIcon}
      title={t("push.title")}
    >
      {permission === "denied" || permission === "unsupported"
        ? t(`push.${permission}`)
        : t("push.desc")}
    </ChannelRow>
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
      <FramePanel render={<ul />}>
        <ChannelRow
          control={
            <Badge variant="success">{t("channels.status.always_on")}</Badge>
          }
          Icon={InboxIcon}
          title={t("channels.list.title")}
        >
          {t("channels.list.desc")}
        </ChannelRow>

        <PushRow />

        <ChannelRow
          control={
            emailState === "unavailable" ? (
              <Badge variant={emailStatus.variant}>
                {t(`channels.status.${emailStatus.key}`)}
              </Badge>
            ) : (
              <Switch
                checked={emailState === "on"}
                id={emailSwitchId}
                onCheckedChange={on => {
                  if (on) onEmailChange(true);
                  else setConfirmOpen(true);
                }}
                ref={emailSwitchRef}
              />
            )
          }
          Icon={MailIcon}
          labelFor={emailState === "unavailable" ? undefined : emailSwitchId}
          title={t("channels.email.title")}
        >
          {emailState === "unavailable" ? (
            t("channels.email.unavailable")
          ) : (
            <>
              {emailState === "on"
                ? t("channels.email.sent_to")
                : t("channels.email.off_to")}{" "}
              <span className="text-foreground font-medium break-all">
                {email}
              </span>
            </>
          )}
        </ChannelRow>
      </FramePanel>

      <ConfirmActionAlertDialog
        description={t("channels.email.stop_desc")}
        finalFocus={emailSwitchRef}
        icon={<MailXIcon />}
        onOpenChange={setConfirmOpen}
        onSubmit={({ onClose }) => {
          onClose();
          onEmailChange(false);
        }}
        open={confirmOpen}
        textSubmit={t("channels.email.stop_submit")}
        title={t("channels.email.stop_title")}
      />
    </Frame>
  );
};
