import { cn } from "cn";
import {
  BellIcon,
  ChevronDownIcon,
  LockIcon,
  type LucideIcon,
  MailIcon,
  SmartphoneIcon,
} from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { NotificationEmailMode } from "@/lib/notifications/types";
import type { NotificationPreferenceTypeView } from "@/views/notifications/notifications-query";

import { RevealPanel } from "@/components/reveal-panel";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";

export type NotificationTypePatch = Partial<
  NotificationPreferenceTypeView["value"]
>;

const ChannelChip = ({
  available,
  Icon,
  label,
  on,
}: {
  available: boolean;
  Icon: LucideIcon;
  label: string;
  on: boolean;
}) => {
  const t = useTranslations("core.auth.settings.notifications.types.summary");

  return (
    <span
      className={cn(
        "flex size-7 items-center justify-center rounded-md",
        !available
          ? "text-muted-foreground/30"
          : on
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground/60",
      )}
    >
      <Icon aria-hidden className="size-4" />
      <span className="sr-only">
        {label}: {!available ? t("unavailable") : on ? t("on") : t("off")}
      </span>
    </span>
  );
};

const ChannelSwitch = ({
  children,
  description,
  disabled,
  Icon,
  label,
  onChange,
  value,
}: {
  children?: React.ReactNode;
  description: string;
  disabled: boolean;
  Icon: LucideIcon;
  label: string;
  onChange: (value: boolean) => void;
  value: boolean;
}) => {
  const id = React.useId();

  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <label
        className="flex min-w-0 flex-1 cursor-pointer items-start gap-3"
        htmlFor={id}
      >
        <Icon
          aria-hidden
          className="text-muted-foreground mt-0.5 size-4 shrink-0"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-muted-foreground text-xs leading-relaxed">
            {description}
          </span>
        </span>
      </label>
      <div className="flex items-center gap-3 ps-7 sm:ps-0">
        {children}
        <Switch
          checked={value}
          disabled={disabled}
          id={id}
          onCheckedChange={onChange}
        />
      </div>
    </div>
  );
};

const EMAIL_DESCRIPTION_KEY = {
  daily: "types.email_daily",
  immediate: "types.email_immediate",
  none: "types.email_off",
  weekly: "types.email_weekly",
} as const satisfies Record<NotificationEmailMode, string>;

const NotificationTypeSummary = ({
  emailOn,
  emailShown,
  isOpen,
  onToggle,
  panelId,
  type,
}: {
  emailOn: boolean;
  emailShown: boolean;
  isOpen: boolean;
  onToggle: () => void;
  panelId: string;
  type: NotificationPreferenceTypeView;
}) => {
  const t = useTranslations("core.auth.settings.notifications");

  return (
    <div className="has-focus-visible:ring-ring/50 [@media(hover:hover)]:hover:bg-muted/40 relative flex items-center gap-3 px-4 py-3 has-focus-visible:ring-3 has-focus-visible:ring-inset">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h4 className="flex items-center gap-1.5 text-sm font-medium text-pretty">
          {type.locked ? (
            <LockIcon
              aria-label={t("locked")}
              className="text-muted-foreground size-3.5 shrink-0"
            />
          ) : null}
          <button
            aria-controls={panelId}
            aria-expanded={isOpen}
            className="text-start outline-none after:absolute after:inset-0"
            onClick={onToggle}
            type="button"
          >
            {type.label}
          </button>
        </h4>
        {type.description ? (
          <span className="text-muted-foreground truncate text-xs">
            {type.description}
          </span>
        ) : null}
      </div>
      <span className="flex shrink-0 items-center gap-0.5">
        <ChannelChip
          available={type.inAppAvailable}
          Icon={BellIcon}
          label={t("types.summary.list")}
          on={type.value.inApp}
        />
        <ChannelChip
          available={type.pushAvailable}
          Icon={SmartphoneIcon}
          label={t("types.summary.push")}
          on={type.value.push}
        />
        <ChannelChip
          available={emailShown}
          Icon={MailIcon}
          label={t("types.summary.email")}
          on={emailOn}
        />
      </span>
      <ChevronDownIcon
        aria-hidden
        className={cn(
          "text-muted-foreground size-4 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
          isOpen && "rotate-180",
        )}
      />
    </div>
  );
};

const EmailFrequencySelect = ({
  frequencies,
  onSelect,
  type,
}: {
  frequencies: NotificationEmailMode[];
  onSelect: (mode: NotificationEmailMode) => void;
  type: NotificationPreferenceTypeView;
}) => {
  const t = useTranslations("core.auth.settings.notifications");
  const frequencyId = React.useId();

  return (
    <>
      <label className="sr-only" htmlFor={frequencyId}>
        {t("types.frequency_label", { type: type.label })}
      </label>
      <NativeSelect
        className="w-44 text-base sm:text-sm"
        id={frequencyId}
        onChange={event => {
          const next = frequencies.find(mode => mode === event.target.value);
          if (next) onSelect(next);
        }}
        size="sm"
        value={type.value.email}
      >
        {frequencies.map(mode => (
          <NativeSelectOption key={mode} value={mode}>
            {t(`email_modes.${mode}`)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </>
  );
};

export const NotificationTypeItem = ({
  isOpen,
  onChange,
  onToggle,
  type,
}: {
  isOpen: boolean;
  onChange: (patch: NotificationTypePatch) => void;
  onToggle: () => void;
  type: NotificationPreferenceTypeView;
}) => {
  const t = useTranslations("core.auth.settings.notifications");
  const panelId = React.useId();
  const emailOn = type.value.email !== "none";
  const emailShown = type.emailModes.length > 0 || type.locked;
  const lastFrequencyRef = React.useRef<NotificationEmailMode>(
    emailOn ? type.value.email : "daily",
  );
  const frequencies = type.emailModes.filter(mode => mode !== "none");
  const canPickFrequency = emailOn && !type.locked && frequencies.length > 1;

  return (
    <li className="border-b last:border-b-0">
      <NotificationTypeSummary
        emailOn={emailOn}
        emailShown={emailShown}
        isOpen={isOpen}
        onToggle={onToggle}
        panelId={panelId}
        type={type}
      />

      <RevealPanel className="overflow-y-clip" id={panelId} open={isOpen}>
        <div className="bg-muted/30 flex flex-col divide-y border-t px-4 py-1">
          {type.locked ? (
            <p className="text-muted-foreground flex items-center gap-1.5 py-3 text-sm">
              <LockIcon aria-hidden className="size-3.5" />
              {type.mandatory ? t("types.mandatory") : t("types.locked")}
            </p>
          ) : null}
          {type.inAppAvailable ? (
            <ChannelSwitch
              description={t("types.list_desc")}
              disabled={type.locked}
              Icon={BellIcon}
              label={t("types.summary.list")}
              onChange={inApp => {
                onChange({ inApp });
              }}
              value={type.value.inApp}
            />
          ) : null}
          {type.pushAvailable ? (
            <ChannelSwitch
              description={t("types.push_desc")}
              disabled={type.locked}
              Icon={SmartphoneIcon}
              label={t("types.summary.push")}
              onChange={push => {
                onChange({ push });
              }}
              value={type.value.push}
            />
          ) : null}
          {emailShown ? (
            <ChannelSwitch
              description={t(EMAIL_DESCRIPTION_KEY[type.value.email])}
              disabled={type.locked}
              Icon={MailIcon}
              label={t("types.summary.email")}
              onChange={on => {
                if (!on && emailOn) lastFrequencyRef.current = type.value.email;
                onChange({ email: on ? lastFrequencyRef.current : "none" });
              }}
              value={emailOn}
            >
              {canPickFrequency ? (
                <EmailFrequencySelect
                  frequencies={frequencies}
                  onSelect={mode => {
                    lastFrequencyRef.current = mode;
                    onChange({ email: mode });
                  }}
                  type={type}
                />
              ) : type.locked && emailOn ? (
                <span className="text-muted-foreground text-sm">
                  {t(`email_modes.${type.value.email}`)}
                </span>
              ) : null}
            </ChannelSwitch>
          ) : null}
        </div>
      </RevealPanel>
    </li>
  );
};
