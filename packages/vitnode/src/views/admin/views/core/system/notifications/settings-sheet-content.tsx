import { cn } from "cn";
import {
  CheckCheckIcon,
  ChevronRightIcon,
  type LucideIcon,
  MailCheckIcon,
  MailXIcon,
  PauseIcon,
  PlayIcon,
  Trash2Icon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { NotificationsAdminActions } from "./notifications-mutations";
import type { AdminNotificationsOverview } from "./notifications-query";

import { DeleteAllDialog } from "./delete-all-dialog";

export interface NotificationsSettingsSheetBodyProps {
  actions: NotificationsAdminActions;
  counts: AdminNotificationsOverview["counts"];
  emailConfigured: boolean;
  settings: AdminNotificationsOverview["settings"];
  workers: AdminNotificationsOverview["workers"];
}

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
  Icon,
  title,
  tone = "danger",
  trailing,
}: {
  confirm: (trigger: React.ReactElement) => React.ReactNode;
  description: string;
  Icon: LucideIcon;
  title: string;
  tone?: "danger" | "safe";
  trailing?: React.ReactNode;
}) => (
  <li>
    {confirm(
      <button
        className="focus-visible:ring-ring/50 [@media(hover:hover)]:hover:bg-muted/50 flex min-h-12 w-full items-center gap-3 px-4 py-3 text-start outline-none focus-visible:ring-3 focus-visible:ring-inset"
        type="button"
      >
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            tone === "danger"
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-foreground",
          )}
        >
          <Icon aria-hidden className="size-4" />
        </span>
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
  counts,
  emailConfigured,
  settings,
  workers,
}: NotificationsSettingsSheetBodyProps) => {
  const t = useTranslations("admin.system.notifications.settings");
  const tTools = useTranslations("admin.system.notifications.tools");
  const tDanger = useTranslations("admin.system.notifications.danger");
  const tError = useTranslations("core.global.errors");

  const failed = () => {
    toast.error(tError("title"), {
      description: tError("internal_server_error"),
    });
  };

  return (
    <div className="flex flex-col gap-6 px-4 py-5">
      {emailConfigured ? (
        <Group title={t("groups.tools")}>
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
        </Group>
      ) : null}

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
            Icon={PlayIcon}
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
            Icon={PauseIcon}
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
          Icon={MailXIcon}
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
          Icon={CheckCheckIcon}
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
          Icon={Trash2Icon}
          title={tDanger("delete_all.title")}
        />
      </Group>

      <p className="text-muted-foreground px-1 text-xs leading-relaxed text-pretty">
        {t("config_note", { days: workers.retentionDays })}
      </p>
    </div>
  );
};
