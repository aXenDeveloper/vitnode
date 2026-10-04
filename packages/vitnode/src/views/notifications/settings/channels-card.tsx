import {
  BellIcon,
  CheckIcon,
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
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SettingsGroup } from "@/views/auth/settings/settings-group";

import type { EmailChannelState } from "./email-channel";

type PushPermission = "default" | "denied" | "granted" | "unsupported";

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
  description,
  htmlFor,
  Icon,
  title,
  trailing,
}: {
  children?: React.ReactNode;
  description: React.ReactNode;
  htmlFor?: string;
  Icon: LucideIcon;
  title: string;
  trailing?: React.ReactNode;
}) => {
  const Text = htmlFor ? "label" : "div";

  return (
    <li className="flex items-center gap-3 px-4 py-4">
      <Icon
        aria-hidden
        className="text-muted-foreground size-5 shrink-0 self-start"
        strokeWidth={1.75}
      />
      <Text className="flex min-w-0 flex-1 flex-col gap-0.5" htmlFor={htmlFor}>
        <span className="text-sm font-medium">{title}</span>
        <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {description}
        </span>
        {children}
      </Text>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </li>
  );
};

const PushRow = () => {
  const t = useTranslations("core.auth.settings.notifications.channels.push");
  const permission = React.useSyncExternalStore<null | PushPermission>(
    subscribeToPermission,
    readPushPermission,
    () => null,
  );
  const [isAsking, setIsAsking] = React.useState(false);
  const blocked = permission === "denied" || permission === "unsupported";

  return (
    <ChannelRow
      description={blocked ? t(permission) : t("desc")}
      Icon={SmartphoneIcon}
      title={t("title")}
      trailing={
        permission === "granted" ? (
          <span className="text-success flex items-center gap-1.5 text-sm font-medium">
            <CheckIcon aria-hidden className="size-4" />
            {t("enabled")}
          </span>
        ) : permission === "default" ? (
          <Button
            aria-label={t("enable")}
            isLoading={isAsking}
            onClick={() => {
              setIsAsking(true);
              void requestPushPermission().then(next => {
                setIsAsking(false);
                if (next === "granted") {
                  toast.success(t("enabled_toast"), {
                    description: t("enabled_toast_desc"),
                  });
                }
              });
            }}
            size="sm"
            variant="outline"
          >
            <BellIcon aria-hidden />
            {t("enable_short")}
          </Button>
        ) : null
      }
    >
      <span className="text-muted-foreground/80 text-xs leading-relaxed text-pretty">
        {t("soon")}
      </span>
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
  const emailSwitchId = React.useId();
  const emailSwitchRef = React.useRef<HTMLButtonElement>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const address = () => (
    <span className="text-foreground font-medium break-all">{email}</span>
  );

  return (
    <SettingsGroup title={t("channels.title")}>
      <PushRow />
      <ChannelRow
        description={
          emailState === "unavailable"
            ? t("channels.email.unavailable")
            : emailState === "on"
              ? t.rich("channels.email.desc", { email: address })
              : t.rich("channels.email.desc_off", { email: address })
        }
        htmlFor={emailState === "unavailable" ? undefined : emailSwitchId}
        Icon={MailIcon}
        title={t("channels.email.title")}
        trailing={
          emailState === "unavailable" ? null : (
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
      />

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
    </SettingsGroup>
  );
};
