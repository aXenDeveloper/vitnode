import { cn } from "cn";
import {
  BellOffIcon,
  ChevronDownIcon,
  ListIcon,
  LockIcon,
  type LucideIcon,
  MailIcon,
  SmartphoneIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { RevealPanel } from "@/components/reveal-panel";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";

import type {
  NotificationsAdminActions,
  NotificationTypePolicyPatch,
} from "./notifications-mutations";
import type { AdminNotificationType } from "./notifications-query";
import type { TypeChoices } from "./type-policy";

import { ResetMembersButton } from "./reset-members";
import {
  applyPatch,
  choicesOf,
  EMAIL_CHOICES,
  emailPatch,
  isSentNowhere,
  LIST_CHOICES,
  listPatch,
  PUSH_CHOICES,
  pushPatch,
} from "./type-policy";

const SummaryChip = ({
  Icon,
  label,
  muted,
  value,
}: {
  Icon: LucideIcon;
  label: string;
  muted: boolean;
  value: string;
}) => (
  <li
    className={cn(
      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap",
      muted ? "text-muted-foreground border-dashed" : "bg-card text-foreground",
    )}
  >
    <Icon aria-hidden className="size-3.5 shrink-0" />
    <span className="sr-only">{label}:</span>
    {value}
  </li>
);

const ChoiceGroup = <V extends string>({
  disabled,
  Icon,
  legend,
  note,
  onChange,
  options,
  value,
}: {
  disabled: boolean;
  Icon: LucideIcon;
  legend: string;
  note?: string;
  onChange: (value: V) => void;
  options: readonly { hint: string; label: string; value: V }[];
  value: V;
}) => {
  return (
    <fieldset className="flex min-w-0 flex-col" disabled={disabled}>
      <legend className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Icon aria-hidden className="text-muted-foreground size-4" />
        {legend}
      </legend>
      <RadioGroup
        className="gap-2"
        disabled={disabled}
        onValueChange={next => {
          const picked = options.find(option => option.value === next);
          if (picked) onChange(picked.value);
        }}
        value={value}
      >
        {options.map(option => (
          <Label
            className={cn(
              "bg-card flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal transition-[border-color,box-shadow] duration-150 ease-out",
              "has-data-checked:border-primary has-data-checked:ring-primary/15 has-disabled:cursor-not-allowed has-disabled:opacity-70 has-data-checked:ring-3",
              "[@media(hover:hover)]:hover:border-foreground/20",
            )}
            key={option.value}
          >
            <RadioGroupItem className="mt-0.5" value={option.value} />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{option.label}</span>
              <span className="text-muted-foreground text-xs leading-relaxed">
                {option.hint}
              </span>
            </span>
          </Label>
        ))}
      </RadioGroup>
      {note ? (
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed text-pretty">
          {note}
        </p>
      ) : null}
    </fieldset>
  );
};

const TypeBadges = ({
  choices,
  missingEmailTemplate,
  sentNowhere,
  type,
}: {
  choices: TypeChoices;
  missingEmailTemplate: boolean;
  sentNowhere: boolean;
  type: AdminNotificationType;
}) => {
  const t = useTranslations("admin.system.notifications.types");
  const lockBadge = type.mandatory
    ? t("badges.mandatory")
    : choices.memberCanEdit
      ? null
      : t("badges.locked");

  if (!lockBadge && !sentNowhere && !type.grouped && !missingEmailTemplate) {
    return null;
  }

  return (
    <span className="flex flex-wrap gap-1">
      {lockBadge ? (
        <Badge variant="outline">
          <LockIcon aria-hidden />
          {lockBadge}
        </Badge>
      ) : null}
      {sentNowhere ? (
        <Badge variant="secondary">{t("badges.nowhere")}</Badge>
      ) : null}
      {type.grouped ? (
        <Badge variant="secondary">{t("badges.grouped")}</Badge>
      ) : null}
      {missingEmailTemplate ? (
        <Badge variant="warning">{t("badges.no_template")}</Badge>
      ) : null}
    </span>
  );
};

const TypeSummaryChips = ({
  choices,
  type,
}: {
  choices: TypeChoices;
  type: AdminNotificationType;
}) => {
  const t = useTranslations("admin.system.notifications.types");
  const short = {
    available: t("summary.available"),
    default_off: t("summary.off"),
    default_on: t("summary.on"),
    disabled: t("summary.disabled"),
  };

  return (
    <ul
      aria-label={t("summary.label", { type: type.label })}
      className="flex flex-wrap gap-1.5"
    >
      <SummaryChip
        Icon={ListIcon}
        label={t("summary.list")}
        muted={choices.list === "disabled"}
        value={short[choices.list]}
      />
      <SummaryChip
        Icon={SmartphoneIcon}
        label={t("summary.push")}
        muted={choices.push === "disabled"}
        value={short[choices.push]}
      />
      <SummaryChip
        Icon={MailIcon}
        label={t("summary.email")}
        muted={choices.email === null || choices.email === "disabled"}
        value={
          choices.email === null
            ? t("summary.unsupported")
            : short[choices.email]
        }
      />
    </ul>
  );
};

const TypeItem = ({
  canEdit,
  isOpen,
  onToggle,
  onUpdate,
  type: initial,
}: {
  canEdit: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onUpdate: NotificationsAdminActions["updateTypePolicy"];
  type: AdminNotificationType;
}) => {
  const t = useTranslations("admin.system.notifications.types");
  const tError = useTranslations("core.global.errors");
  const panelId = React.useId();
  const memberId = React.useId();
  const [, startTransition] = React.useTransition();
  const [type, applyOptimistic] = React.useOptimistic(initial, applyPatch);
  const choices = choicesOf(type);
  const sentNowhere = isSentNowhere(choices);
  const missingEmailTemplate =
    type.emailSupported && !type.emailAvailable && choices.email !== "disabled";
  const locked = !canEdit;

  const save = (patch: NotificationTypePolicyPatch) => {
    startTransition(async () => {
      applyOptimistic(patch);
      const mutation = await onUpdate(type.id, patch);

      if (mutation.error !== undefined) {
        toast.error(tError("title"), {
          description: tError("internal_server_error"),
        });

        return;
      }

      toast.success(t("success"), {
        description: t("success_desc", { type: type.label }),
      });
    });
  };

  const listOptions = LIST_CHOICES.map(value => ({
    hint: t(`list.${value}.hint`),
    label: t(`list.${value}.label`),
    value,
  }));
  const pushOptions = PUSH_CHOICES.map(value => ({
    hint: t(`push.${value}.hint`),
    label: t(`push.${value}.label`),
    value,
  }));
  const emailOptions = EMAIL_CHOICES.map(value => ({
    hint: t(`email.${value}.hint`),
    label: t(`email.${value}.label`),
    value,
  }));

  return (
    <li className="border-b last:border-b-0">
      <div className="has-focus-visible:ring-ring/50 [@media(hover:hover)]:hover:bg-muted/40 relative flex flex-col gap-3 px-4 py-4 has-focus-visible:ring-3 has-focus-visible:ring-inset sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h4
            className={cn(
              "text-sm leading-snug font-medium text-pretty break-words",
              sentNowhere && "text-muted-foreground",
            )}
          >
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
          <span className="text-muted-foreground font-mono text-xs break-all">
            {type.id}
          </span>
          <TypeBadges
            choices={choices}
            missingEmailTemplate={missingEmailTemplate}
            sentNowhere={sentNowhere}
            type={type}
          />
        </div>
        <div className="flex items-center justify-between gap-3 md:justify-end">
          <TypeSummaryChips choices={choices} type={type} />
          <ChevronDownIcon
            aria-hidden
            className={cn(
              "text-muted-foreground size-4 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
              isOpen && "rotate-180",
            )}
          />
        </div>
      </div>

      <RevealPanel className="overflow-y-clip" id={panelId} open={isOpen}>
        <div className="bg-muted/30 flex flex-col gap-6 border-t px-4 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <Label
              className="flex flex-col items-start gap-1 font-normal"
              htmlFor={memberId}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <LockIcon
                  aria-hidden
                  className="text-muted-foreground size-4"
                />
                {t("member_can_edit.label")}
              </span>
              <span className="text-muted-foreground text-xs leading-relaxed text-pretty">
                {type.mandatory
                  ? t("member_can_edit.mandatory")
                  : t("member_can_edit.desc")}
              </span>
            </Label>
            <Switch
              checked={choices.memberCanEdit}
              disabled={locked || type.mandatory}
              id={memberId}
              onCheckedChange={memberCanEdit => {
                save({ memberCanEdit });
              }}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <ChoiceGroup
              disabled={locked || type.mandatory}
              Icon={ListIcon}
              legend={t("list.legend")}
              note={type.mandatory ? t("list.mandatory") : undefined}
              onChange={choice => {
                save(listPatch(choice));
              }}
              options={listOptions}
              value={choices.list}
            />
            <ChoiceGroup
              disabled={locked}
              Icon={SmartphoneIcon}
              legend={t("push.legend")}
              note={t("push.note")}
              onChange={choice => {
                save(pushPatch(choice));
              }}
              options={pushOptions}
              value={choices.push}
            />
            {choices.email === null ? (
              <div className="flex min-w-0 flex-col">
                <p className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <MailIcon
                    aria-hidden
                    className="text-muted-foreground size-4"
                  />
                  {t("email.legend")}
                </p>
                <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm leading-relaxed">
                  {t("email.unsupported")}
                </p>
              </div>
            ) : (
              <ChoiceGroup
                disabled={locked}
                Icon={MailIcon}
                legend={t("email.legend")}
                onChange={choice => {
                  save(emailPatch(choice, type));
                }}
                options={emailOptions}
                value={choices.email}
              />
            )}
          </div>
        </div>
      </RevealPanel>
    </li>
  );
};

export const NotificationsTypesSection = ({
  actions,
  canEdit,
  canManage,
  customizedMembers,
  types,
}: {
  actions: NotificationsAdminActions;
  canEdit: boolean;
  canManage: boolean;
  customizedMembers: number;
  types: AdminNotificationType[];
}) => {
  const t = useTranslations("admin.system.notifications.types");
  const [openId, setOpenId] = React.useState<null | string>(null);
  const groups = [...new Set(types.map(type => type.pluginId))].map(
    pluginId => ({
      pluginId,
      types: types.filter(type => type.pluginId === pluginId),
    }),
  );

  return (
    <section
      aria-labelledby="notifications-types"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex max-w-2xl flex-col gap-1">
          <h2
            className="text-lg font-semibold text-balance"
            id="notifications-types"
          >
            {t("title")}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {canEdit ? t("desc") : `${t("desc")} ${t("read_only")}`}
          </p>
        </div>
        {canManage ? (
          <ResetMembersButton
            count={customizedMembers}
            onReset={actions.resetMemberPreferences}
          />
        ) : null}
      </div>

      {types.length === 0 ? (
        <Card>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BellOffIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle>{t("empty.title")}</EmptyTitle>
              <EmptyDescription>{t("empty.desc")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Card>
      ) : (
        groups.map(group => (
          <div className="flex flex-col gap-2" key={group.pluginId}>
            <h3 className="text-muted-foreground text-xs font-medium">
              {group.pluginId}
            </h3>
            <Card className="gap-0 py-0">
              <ul>
                {group.types.map(type => (
                  <TypeItem
                    canEdit={canEdit}
                    isOpen={openId === type.id}
                    key={type.id}
                    onToggle={() => {
                      setOpenId(current =>
                        current === type.id ? null : type.id,
                      );
                    }}
                    onUpdate={actions.updateTypePolicy}
                    type={type}
                  />
                ))}
              </ul>
            </Card>
          </div>
        ))
      )}
    </section>
  );
};
