import { cn } from "cn";
import {
  BrushCleaningIcon,
  ChevronRightIcon,
  type LucideIcon,
  MailCheckIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useFormatter, useTranslations } from "use-intl";
import { z } from "zod";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { AutoForm } from "@/components/form/auto-form";
import { AutoFormNumber } from "@/components/form/fields/number";
import { AutoFormSelect } from "@/components/form/fields/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

import type { NotificationsAdminActions } from "./notifications-mutations";
import type {
  AdminNotificationEditableSettings,
  AdminNotificationsOverview,
} from "./notifications-query";

import { DeleteAllDialog } from "./delete-all-dialog";

export interface NotificationsSettingsSheetBodyProps {
  actions: NotificationsAdminActions;
  canEdit: boolean;
  canManage: boolean;
  counts: AdminNotificationsOverview["counts"];
  emailConfigured: boolean;
  settings: AdminNotificationsOverview["settings"];
  workers: AdminNotificationsOverview["workers"];
}

type NumberKey = "emailCapPerHour";

const LIMITS = {
  emailCapPerHour: [0, 500],
} as const satisfies Record<NumberKey, readonly [number, number]>;

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour));
const WEEKDAYS = ["0", "1", "2", "3", "4", "5", "6"];

const Group = ({
  children,
  title,
  tone,
}: {
  children: React.ReactNode;
  title: string;
  tone?: "danger";
}) => {
  const id = React.useId();

  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3
        className={cn(
          "px-1 text-xs font-medium",
          tone === "danger" ? "text-destructive" : "text-muted-foreground",
        )}
        id={id}
      >
        {title}
      </h3>
      <ul
        className={cn(
          "bg-card divide-y overflow-hidden rounded-xl border",
          tone === "danger" && "border-destructive/40 divide-destructive/20",
        )}
      >
        {children}
      </ul>
    </section>
  );
};

const RowText = ({
  description,
  label,
  tone,
}: {
  description?: string;
  label: string;
  tone?: "danger";
}) => (
  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
    <span
      className={cn(
        "text-sm font-medium",
        tone === "danger" && "text-destructive",
      )}
    >
      {label}
    </span>
    {description ? (
      <span className="text-muted-foreground text-xs leading-relaxed text-pretty">
        {description}
      </span>
    ) : null}
  </span>
);

const rowButtonClass =
  "focus-visible:ring-ring/50 flex min-h-12 w-full items-center gap-3 px-4 py-3 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-inset [@media(hover:hover)]:hover:bg-muted/50";

const EditableRow = ({
  canEdit,
  children,
  isOpen,
  label,
  onToggle,
  value,
}: {
  canEdit: boolean;
  children: React.ReactNode;
  isOpen: boolean;
  label: string;
  onToggle: () => void;
  value: string;
}) => {
  const t = useTranslations("admin.system.notifications.settings");
  const panelId = React.useId();

  if (!canEdit) {
    return (
      <li className="flex min-h-12 items-center gap-3 px-4 py-3">
        <RowText label={label} />
        <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
          {value}
        </span>
      </li>
    );
  }

  return (
    <li>
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        aria-label={`${t("edit", { label })}: ${value}`}
        className={rowButtonClass}
        onClick={onToggle}
        type="button"
      >
        <RowText label={label} />
        <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
          {value}
        </span>
        <ChevronRightIcon
          aria-hidden
          className={cn(
            "text-muted-foreground size-4 shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none",
            isOpen && "rotate-90",
          )}
        />
      </button>
      {isOpen ? (
        <div className="bg-muted/30 border-t px-4 py-4" id={panelId}>
          {children}
        </div>
      ) : null}
    </li>
  );
};

const EditorFooter = ({
  isSaving,
  onCancel,
}: {
  isSaving: boolean;
  onCancel: () => void;
}) => {
  const t = useTranslations("admin.system.notifications.settings");

  return (
    <div className="flex justify-end gap-2">
      <Button onClick={onCancel} type="button" variant="ghost">
        {t("cancel")}
      </Button>
      <Button isLoading={isSaving} type="submit">
        {t("save")}
      </Button>
    </div>
  );
};

const useSettingSaver = ({
  actions,
  onSaved,
}: {
  actions: NotificationsAdminActions;
  onSaved: () => void;
}) => {
  const t = useTranslations("admin.system.notifications.settings");
  const tError = useTranslations("core.global.errors");
  const [isSaving, setIsSaving] = React.useState(false);

  const save = async (
    patch: Partial<AdminNotificationEditableSettings>,
    label: string,
    value: string,
  ) => {
    setIsSaving(true);
    const mutation = await actions.updateSettings(patch);
    setIsSaving(false);

    if (mutation.error !== undefined) {
      toast.error(tError("title"), {
        description: tError("internal_server_error"),
      });

      return;
    }

    onSaved();
    toast.success(t("success"), {
      description: t("success_desc", { label, value }),
    });
  };

  return { isSaving, save };
};

const NumberEditor = ({
  actions,
  display,
  field,
  onDone,
  saved,
}: {
  actions: NotificationsAdminActions;
  display: (value: number) => string;
  field: NumberKey;
  onDone: () => void;
  saved: number;
}) => {
  const t = useTranslations("admin.system.notifications.settings");
  const [min, max] = LIMITS[field];
  const { isSaving, save } = useSettingSaver({ actions, onSaved: onDone });
  const formSchema = z.object({
    [field]: z.number().int().min(min).max(max).default(saved),
  });

  return (
    <AutoForm
      fields={[
        {
          id: field,
          component: props => (
            <AutoFormNumber
              {...props}
              autoFocus
              className="w-full sm:w-48"
              description={t(`${field}.desc`)}
              label={t(`${field}.label`)}
              max={max}
              min={min}
              step={1}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      layout={rendered => (
        <div className="flex flex-col gap-4">
          {rendered[field]}
          <EditorFooter isSaving={isSaving} onCancel={onDone} />
        </div>
      )}
      onSubmit={async values => {
        const value = values[field];
        await save({ [field]: value }, t(`${field}.label`), display(value));
      }}
    />
  );
};

const SelectEditor = ({
  actions,
  field,
  labels,
  onDone,
  saved,
}: {
  actions: NotificationsAdminActions;
  field: "digestHour" | "digestWeekday";
  labels: { label: string; value: string }[];
  onDone: () => void;
  saved: number;
}) => {
  const t = useTranslations("admin.system.notifications.settings");
  const { isSaving, save } = useSettingSaver({ actions, onSaved: onDone });
  const values = labels.map(item => item.value) as [string, ...string[]];
  const formSchema = z.object({
    [field]: z.enum(values).default(String(saved)),
  });

  return (
    <AutoForm
      fields={[
        {
          id: field,
          component: props => (
            <AutoFormSelect
              {...props}
              description={t(`${field}.desc`)}
              label={t(`${field}.label`)}
              labels={labels}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      layout={rendered => (
        <div className="flex flex-col gap-4">
          {rendered[field]}
          <EditorFooter isSaving={isSaving} onCancel={onDone} />
        </div>
      )}
      onSubmit={async submitted => {
        const value = Number(submitted[field]);
        await save(
          { [field]: value },
          t(`${field}.label`),
          labels.find(item => item.value === String(value))?.label ??
            String(value),
        );
      }}
    />
  );
};

const ActionRow = ({
  description,
  Icon,
  label,
  onRun,
}: {
  description: string;
  Icon: LucideIcon;
  label: string;
  onRun: () => Promise<void>;
}) => {
  const t = useTranslations("admin.system.notifications.tools");
  const [isRunning, setIsRunning] = React.useState(false);

  return (
    <li className="flex min-h-12 items-center gap-3 px-4 py-3">
      <Icon aria-hidden className="text-muted-foreground size-4 shrink-0" />
      <RowText description={description} label={label} />
      <Button
        aria-label={t("run_label", { label })}
        className="shrink-0"
        isLoading={isRunning}
        onClick={() => {
          setIsRunning(true);
          void onRun().finally(() => {
            setIsRunning(false);
          });
        }}
        size="sm"
        variant="outline"
      >
        {t("run")}
      </Button>
    </li>
  );
};

const DangerRow = ({
  confirm,
  description,
  title,
  tone = "danger",
  trailing,
}: {
  confirm: (trigger: React.ReactElement) => React.ReactNode;
  description: string;
  title: string;
  tone?: "danger" | "safe";
  trailing?: React.ReactNode;
}) => (
  <li>
    {confirm(
      <button className={rowButtonClass} type="button">
        <RowText
          description={description}
          label={title}
          tone={tone === "danger" ? "danger" : undefined}
        />
        {trailing}
        <ChevronRightIcon
          aria-hidden
          className="text-muted-foreground size-4 shrink-0"
        />
      </button>,
    )}
  </li>
);

export const NotificationsSettingsSheetBody = ({
  actions,
  canEdit,
  canManage,
  counts,
  emailConfigured,
  settings,
  workers,
}: NotificationsSettingsSheetBodyProps) => {
  const t = useTranslations("admin.system.notifications.settings");
  const tTools = useTranslations("admin.system.notifications.tools");
  const tDanger = useTranslations("admin.system.notifications.danger");
  const tError = useTranslations("core.global.errors");
  const format = useFormatter();
  const [openKey, setOpenKey] = React.useState<null | string>(null);
  const emailSwitchId = React.useId();
  const [emailEnabled, setEmailEnabled] = React.useState(settings.emailEnabled);

  const toggle = (key: string) => () => {
    setOpenKey(current => (current === key ? null : key));
  };
  const close = () => {
    setOpenKey(null);
  };

  const hourLabels = HOURS.map(hour => ({
    label: format.dateTime(new Date(Date.UTC(2024, 0, 1, Number(hour))), {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }),
    value: hour,
  }));
  const weekdayLabels = WEEKDAYS.map(day => ({
    label: format.dateTime(new Date(Date.UTC(2024, 0, 7 + Number(day))), {
      timeZone: "UTC",
      weekday: "long",
    }),
    value: day,
  }));

  const display = {
    emailCapPerHour: (value: number) =>
      value === 0 ? t("emailCapPerHour.none") : format.number(value),
  } satisfies Record<NumberKey, (value: number) => string>;

  const failed = () => {
    toast.error(tError("title"), {
      description: tError("internal_server_error"),
    });
  };

  const numberRow = (field: NumberKey) => (
    <EditableRow
      canEdit={canEdit}
      isOpen={openKey === field}
      key={field}
      label={t(`${field}.label`)}
      onToggle={toggle(field)}
      value={display[field](settings[field])}
    >
      <NumberEditor
        actions={actions}
        display={display[field]}
        field={field}
        onDone={close}
        saved={settings[field]}
      />
    </EditableRow>
  );

  return (
    <div className="flex flex-col gap-6 px-4 py-5">
      <Group title={t("groups.email")}>
        <li className="flex min-h-12 items-center justify-between gap-3 px-4 py-3">
          <label className="flex flex-col gap-0.5" htmlFor={emailSwitchId}>
            <span className="text-sm font-medium">
              {t("emailEnabled.label")}
            </span>
            <span className="text-muted-foreground text-xs leading-relaxed text-pretty">
              {t("emailEnabled.desc")}
            </span>
          </label>
          <Switch
            checked={emailEnabled}
            disabled={!canEdit}
            id={emailSwitchId}
            onCheckedChange={checked => {
              setEmailEnabled(checked);
              void actions
                .updateSettings({ emailEnabled: checked })
                .then(mutation => {
                  if (mutation.error !== undefined) {
                    setEmailEnabled(!checked);
                    failed();

                    return;
                  }
                  toast.success(t("success"), {
                    description: t("success_desc", {
                      label: t("emailEnabled.label"),
                      value: checked ? t("on") : t("off"),
                    }),
                  });
                });
            }}
          />
        </li>
        {numberRow("emailCapPerHour")}
        <EditableRow
          canEdit={canEdit}
          isOpen={openKey === "digestHour"}
          label={t("digestHour.label")}
          onToggle={toggle("digestHour")}
          value={hourLabels[settings.digestHour]?.label ?? ""}
        >
          <SelectEditor
            actions={actions}
            field="digestHour"
            labels={hourLabels}
            onDone={close}
            saved={settings.digestHour}
          />
        </EditableRow>
        <EditableRow
          canEdit={canEdit}
          isOpen={openKey === "digestWeekday"}
          label={t("digestWeekday.label")}
          onToggle={toggle("digestWeekday")}
          value={weekdayLabels[settings.digestWeekday]?.label ?? ""}
        >
          <SelectEditor
            actions={actions}
            field="digestWeekday"
            labels={weekdayLabels}
            onDone={close}
            saved={settings.digestWeekday}
          />
        </EditableRow>
      </Group>

      {canManage ? (
        <>
          <Group title={t("groups.tools")}>
            {emailConfigured ? (
              <ActionRow
                description={tTools("test_email.desc")}
                Icon={MailCheckIcon}
                label={tTools("test_email.label")}
                onRun={async () => {
                  const mutation = await actions.sendTestEmail();
                  if (mutation.error !== undefined) {
                    if (mutation.status === 400) {
                      toast.error(tError("title"), {
                        description: tTools("test_email.not_configured"),
                      });
                    } else failed();

                    return;
                  }
                  toast.success(tTools("test_email.success"), {
                    description: tTools("test_email.success_desc", {
                      id: mutation.data.deliveryId,
                    }),
                  });
                }}
              />
            ) : null}
            <ActionRow
              description={tTools("cleanup.desc", {
                count: workers.retentionDays,
              })}
              Icon={BrushCleaningIcon}
              label={tTools("cleanup.label")}
              onRun={async () => {
                const mutation = await actions.cleanup();
                if (mutation.error !== undefined) {
                  failed();

                  return;
                }
                toast.success(tTools("cleanup.success"), {
                  description: tTools("cleanup.success_desc"),
                });
              }}
            />
          </Group>

          <Group title={t("groups.danger")} tone="danger">
            <li className="text-muted-foreground px-4 py-3 text-xs leading-relaxed">
              {tDanger("intro")}
            </li>
            {settings.paused ? (
              <DangerRow
                confirm={trigger => (
                  <ConfirmActionAlertDialog
                    description={tDanger("resume.confirm_desc")}
                    onSubmit={async ({ onClose }) => {
                      const mutation = await actions.resume();
                      if (mutation.error !== undefined) {
                        failed();

                        return;
                      }
                      onClose();
                      toast.success(tDanger("resume.success"), {
                        description: tDanger("resume.success_desc", {
                          count: mutation.data.requeuedEvents,
                        }),
                      });
                    }}
                    submitVariant="default"
                    textSubmit={tDanger("resume.submit")}
                    title={`${tDanger("resume.title")}?`}
                  >
                    {trigger}
                  </ConfirmActionAlertDialog>
                )}
                description={tDanger("resume.desc")}
                title={tDanger("resume.title")}
                tone="safe"
                trailing={
                  <Badge variant="warning">{tDanger("paused_badge")}</Badge>
                }
              />
            ) : (
              <DangerRow
                confirm={trigger => (
                  <ConfirmActionAlertDialog
                    description={tDanger("pause.confirm_desc")}
                    onSubmit={async ({ onClose }) => {
                      const mutation = await actions.pause();
                      if (mutation.error !== undefined) {
                        failed();

                        return;
                      }
                      onClose();
                      toast.success(tDanger("pause.success"), {
                        description: tDanger("pause.success_desc"),
                      });
                    }}
                    textSubmit={tDanger("pause.submit")}
                    title={`${tDanger("pause.title")}?`}
                  >
                    {trigger}
                  </ConfirmActionAlertDialog>
                )}
                description={tDanger("pause.desc")}
                title={tDanger("pause.title")}
              />
            )}
            <DangerRow
              confirm={trigger => (
                <ConfirmActionAlertDialog
                  description={tDanger("cancel_emails.confirm_desc", {
                    count: counts.queuedEmails,
                  })}
                  onSubmit={async ({ onClose }) => {
                    const mutation = await actions.cancelQueuedEmails();
                    if (mutation.error !== undefined) {
                      failed();

                      return;
                    }
                    onClose();
                    toast.success(tDanger("cancel_emails.success"), {
                      description: tDanger("cancel_emails.success_desc", {
                        count: mutation.data.cancelled,
                      }),
                    });
                  }}
                  textSubmit={tDanger("cancel_emails.submit")}
                  title={`${tDanger("cancel_emails.title")}?`}
                >
                  {trigger}
                </ConfirmActionAlertDialog>
              )}
              description={tDanger("cancel_emails.desc")}
              title={tDanger("cancel_emails.title")}
            />
            <DangerRow
              confirm={trigger => (
                <ConfirmActionAlertDialog
                  description={tDanger("read_all.confirm_desc", {
                    count: counts.unreadItems,
                  })}
                  onSubmit={async ({ onClose }) => {
                    const mutation = await actions.markEverythingRead();
                    if (mutation.error !== undefined) {
                      failed();

                      return;
                    }
                    onClose();
                    toast.success(tDanger("read_all.success"), {
                      description: tDanger("read_all.success_desc", {
                        count: mutation.data.items,
                      }),
                    });
                  }}
                  textSubmit={tDanger("read_all.submit")}
                  title={`${tDanger("read_all.title")}?`}
                >
                  {trigger}
                </ConfirmActionAlertDialog>
              )}
              description={tDanger("read_all.desc")}
              title={tDanger("read_all.title")}
            />
            <DangerRow
              confirm={trigger => (
                <DeleteAllDialog
                  count={counts.inboxItems}
                  onDelete={actions.deleteAll}
                  trigger={trigger}
                />
              )}
              description={tDanger("delete_all.desc")}
              title={tDanger("delete_all.title")}
            />
          </Group>
        </>
      ) : null}

      <p className="text-muted-foreground px-1 text-xs leading-relaxed text-pretty">
        {t("config_note", { days: workers.retentionDays })}
      </p>
    </div>
  );
};
