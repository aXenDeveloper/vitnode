import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import {
  ChevronDownIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  FlagIcon,
  PuzzleIcon,
  TrashIcon,
  UserCheckIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { DateFormat } from "@/components/date-format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReportReasonLabel } from "@/views/moderation/report-reason-label";

import type { ModcpReportDetail } from "./modcp-query";
import type { ReportStatus } from "./report-tone";

import {
  assignReport,
  claimReport,
  runReportAction,
} from "../moderation-mutations";
import { modcpAssigneesQueryOptions } from "./modcp-query";
import {
  ReopenReportForm,
  ResolveReportForm,
  useReportFailure,
} from "./report-forms";
import {
  Chip,
  Person,
  REASON_TONE,
  STATUS_TONE,
  StatusLozenge,
  TONE_SURFACE,
} from "./report-tone";

type Dialogs = "close" | "reopen" | null;

interface ReportContext {
  data: ModcpReportDetail;
  onDone: () => Promise<void>;
  userId: number;
}

const ActionDialogs = ({
  data,
  dialog,
  onDone,
  setDialog,
}: ReportContext & {
  dialog: Dialogs;
  setDialog: (next: Dialogs) => void;
}) => {
  const t = useTranslations("core.moderation.modcp.detail");
  const { report } = data;
  const finish = async () => {
    setDialog(null);
    await onDone();
  };

  return (
    <Dialog
      onOpenChange={open => {
        if (!open) setDialog(null);
      }}
      open={dialog !== null}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {dialog === "reopen"
              ? t("reopen.dialog_title", { id: report.id })
              : t("resolve.dialog_title", { id: report.id })}
          </DialogTitle>
          <DialogDescription>
            {dialog === "reopen"
              ? t("reopen.dialog_desc")
              : t("resolve.success_desc")}
          </DialogDescription>
        </DialogHeader>
        {dialog === "reopen" ? (
          <ReopenReportForm
            expectedVersion={report.version}
            id={report.id}
            onDone={finish}
          />
        ) : (
          <ResolveReportForm
            defaultResolution={data.current.hidden ? "action_taken" : undefined}
            expectedVersion={report.version}
            id={report.id}
            onDone={finish}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

const StatusButton = ({ data, onDone, userId }: ReportContext) => {
  const t = useTranslations("core.moderation");
  const fail = useReportFailure();
  const [dialog, setDialog] = React.useState<Dialogs>(null);
  const [isRunning, setIsRunning] = React.useState(false);
  const { report } = data;
  const isMine = data.assignee?.id === userId;

  if (!data.permissions.manage) {
    return (
      <span
        className={cn(
          "flex h-9 items-center justify-center rounded-md px-3 text-sm font-bold tracking-wide uppercase",
          TONE_SURFACE[STATUS_TONE[report.status]],
        )}
      >
        {t(`statuses.${report.status}`)}
      </span>
    );
  }

  const claim = async () => {
    const result = await claimReport({
      expectedVersion: report.version,
      id: report.id,
    });
    if (!fail(result)) {
      toast.success(t("modcp.detail.assignment.claimed"), {
        description: t("modcp.detail.assignment.claimed_desc"),
      });
    }
    await onDone();
  };

  const stop = async () => {
    const result = await assignReport({
      assigneeId: null,
      expectedVersion: report.version,
      id: report.id,
    });
    if (!fail(result)) toast.success(t("modcp.detail.assignment.assigned"));
    await onDone();
  };

  const transitions: {
    label: string;
    run: () => Promise<void> | void;
    to: ReportStatus;
  }[] =
    report.status === "done"
      ? [
          {
            label: t("modcp.detail.status.reopen"),
            run: () => {
              setDialog("reopen");
            },
            to: "in_progress",
          },
        ]
      : [
          ...(report.status === "new"
            ? [
                {
                  label: t("modcp.detail.status.start"),
                  run: claim,
                  to: "in_progress" as const,
                },
              ]
            : []),
          {
            label: t("modcp.detail.status.close"),
            run: () => {
              setDialog("close");
            },
            to: "done",
          },
          ...(report.status === "in_progress" && isMine
            ? [
                {
                  label: t("modcp.detail.status.stop"),
                  run: stop,
                  to: "new" as const,
                },
              ]
            : []),
        ];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              className={cn(
                "h-9 w-full gap-1.5 px-3 font-bold tracking-wide uppercase hover:brightness-95",
                TONE_SURFACE[STATUS_TONE[report.status]],
              )}
              isLoading={isRunning}
              variant="ghost"
            />
          }
        >
          {t(`statuses.${report.status}`)}
          <ChevronDownIcon aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60">
          <DropdownMenuLabel>
            {t("modcp.detail.status.move_to")}
          </DropdownMenuLabel>
          {transitions.map(transition => (
            <DropdownMenuItem
              key={transition.label}
              onClick={async () => {
                setIsRunning(true);
                try {
                  await transition.run();
                } finally {
                  setIsRunning(false);
                }
              }}
            >
              <span className="flex-1">{transition.label}</span>
              <StatusLozenge status={transition.to} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <ActionDialogs
        data={data}
        dialog={dialog}
        onDone={onDone}
        setDialog={setDialog}
        userId={userId}
      />
    </>
  );
};

const ActionsMenu = ({ data, onDone }: ReportContext) => {
  const t = useTranslations("core.moderation.modcp.detail");
  const fail = useReportFailure();
  const [confirming, setConfirming] = React.useState<"hide" | "unhide" | null>(
    null,
  );
  const actions = data.permissions.actions.filter(
    action => action.available && action.allowed,
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button className="h-9" variant="outline" />}
        >
          {t("actions.menu")}
          <ChevronDownIcon aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            disabled={!data.current.url}
            onClick={() => {
              if (data.current.url) {
                window.open(data.current.url, "_blank", "noopener");
              }
            }}
          >
            <ExternalLinkIcon aria-hidden />
            {t("current.open")}
          </DropdownMenuItem>
          {actions.length > 0 ? <DropdownMenuSeparator /> : null}
          {actions.map(action => (
            <DropdownMenuItem
              key={action.action}
              onClick={() => {
                setConfirming(action.action);
              }}
              variant={action.action === "hide" ? "destructive" : "default"}
            >
              {action.action === "hide" ? (
                <EyeOffIcon aria-hidden />
              ) : (
                <EyeIcon aria-hidden />
              )}
              {t(`actions.${action.action}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmActionAlertDialog
        description={confirming ? t(`actions.${confirming}_desc`) : undefined}
        onOpenChange={open => {
          if (!open) setConfirming(null);
        }}
        onSubmit={async ({ onClose }) => {
          if (!confirming) return;
          const result = await runReportAction({
            action: confirming,
            expectedVersion: data.report.version,
            id: data.report.id,
          });
          if (!fail(result) && result.ok) {
            toast.success(
              result.data.changed
                ? t(
                    confirming === "hide"
                      ? "actions.hidden"
                      : "actions.unhidden",
                  )
                : t("actions.unchanged"),
              result.data.changed
                ? { description: t("actions.recorded") }
                : undefined,
            );
          }
          onClose();
          setConfirming(null);
          await onDone();
        }}
        open={confirming !== null}
        submitVariant={confirming === "hide" ? "destructive" : "default"}
        textSubmit={t("actions.confirm")}
        title={confirming ? t(`actions.confirm_${confirming}`) : undefined}
      />
    </>
  );
};

const FieldRow = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) => (
  <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-3 py-2 text-sm">
    <dt className="text-muted-foreground pt-1">{label}</dt>
    <dd className="text-foreground min-w-0 pt-1">{children}</dd>
  </div>
);

const AssigneeField = ({ data, onDone, userId }: ReportContext) => {
  const t = useTranslations("core.moderation.modcp.detail");
  const fail = useReportFailure();
  const { report } = data;
  const canChange = data.permissions.manage && report.status !== "done";
  const assignees = useQuery({
    ...modcpAssigneesQueryOptions(report.id),
    enabled: canChange,
  });
  const canTakeIt =
    canChange &&
    data.assignee?.id !== userId &&
    (assignees.data ?? []).some(user => user.id === userId);

  const [isAssigning, setIsAssigning] = React.useState(false);

  const assign = async (assigneeId: null | number) => {
    if (isAssigning) return;

    setIsAssigning(true);
    try {
      await assignTo(assigneeId);
    } finally {
      setIsAssigning(false);
    }
  };

  const assignTo = async (assigneeId: null | number) => {
    const result =
      assigneeId === userId && data.assignee === null
        ? await claimReport({ expectedVersion: report.version, id: report.id })
        : await assignReport({
            assigneeId,
            expectedVersion: report.version,
            id: report.id,
          });
    if (!fail(result)) {
      toast.success(t("assignment.assigned"), {
        description: t("assignment.assigned_desc"),
      });
    }
    await onDone();
  };

  const current = data.assignee ? (
    <Person person={data.assignee} />
  ) : (
    <>
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed"
      >
        <UserCheckIcon className="text-muted-foreground size-3.5" />
      </span>
      <span className="text-muted-foreground">{t("details.unassigned")}</span>
    </>
  );

  return (
    <div className="flex flex-col items-start gap-1">
      {canChange ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                aria-busy={isAssigning || undefined}
                className="hover:bg-muted focus-visible:ring-ring/50 -mx-1.5 flex max-w-full items-center gap-2 rounded-md px-1.5 py-1 text-sm outline-none focus-visible:ring-3 disabled:opacity-50"
                disabled={isAssigning}
                type="button"
              />
            }
          >
            {current}
            <ChevronDownIcon
              aria-hidden
              className="text-muted-foreground size-3.5 shrink-0"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64">
            <DropdownMenuLabel>{t("details.assignee")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              onValueChange={async value => {
                await assign(value === "none" ? null : Number(value));
              }}
              value={data.assignee ? String(data.assignee.id) : "none"}
            >
              <DropdownMenuRadioItem value="none">
                {t("details.unassigned")}
              </DropdownMenuRadioItem>
              <DropdownMenuSeparator />
              {(assignees.data ?? []).map(user => (
                <DropdownMenuRadioItem key={user.id} value={String(user.id)}>
                  <Person person={user} size={20} />
                  {user.id === userId ? (
                    <span className="text-muted-foreground text-xs">
                      {t("details.you")}
                    </span>
                  ) : null}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="flex items-center gap-2 py-1">{current}</span>
      )}
      {canTakeIt ? (
        <Button
          className="ms-8 h-auto px-0"
          isLoading={isAssigning}
          onClick={async () => {
            await assign(userId);
          }}
          size="xs"
          variant="link"
        >
          {t("details.assign_to_me")}
        </Button>
      ) : null}
    </div>
  );
};

const ContentCard = ({
  data,
  typeLabel,
}: {
  data: ModcpReportDetail;
  typeLabel: string;
}) => {
  const t = useTranslations("core.moderation.modcp.detail");
  const title =
    typeof data.snapshot.title === "string" && data.snapshot.title
      ? data.snapshot.title
      : t("content_card.untitled");

  return (
    <div className="bg-muted/40 ring-foreground/5 flex gap-3 rounded-lg p-3 ring-1">
      <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md">
        <PuzzleIcon aria-hidden className="size-4" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-muted-foreground text-xs">{typeLabel}</span>
        {data.current.url ? (
          <a
            className="text-foreground focus-visible:ring-ring/50 line-clamp-2 rounded-sm text-sm leading-snug font-medium outline-none hover:underline focus-visible:ring-3"
            href={data.current.url}
            rel="noopener"
            target="_blank"
          >
            {title}
          </a>
        ) : (
          <span className="text-foreground line-clamp-2 text-sm leading-snug font-medium">
            {title}
          </span>
        )}
      </div>
    </div>
  );
};

const Visibility = ({ data }: { data: ModcpReportDetail }) => {
  const t = useTranslations("core.moderation.modcp.detail.current");

  if (!data.current.registered || !data.current.exists) {
    return (
      <span className="text-muted-foreground flex items-center gap-1.5">
        <TrashIcon aria-hidden className="size-3.5" />
        {t(data.current.registered ? "deleted" : "unregistered")}
      </span>
    );
  }

  return data.current.hidden ? (
    <Chip icon={EyeOffIcon} tone="warning">
      {t("hidden")}
    </Chip>
  ) : (
    <Chip icon={EyeIcon} tone="success">
      {t("visible")}
    </Chip>
  );
};

export const ReportSidebar = ({
  data,
  onDone,
  pluginName,
  typeLabel,
  userId,
}: ReportContext & { pluginName: string; typeLabel: string }) => {
  const t = useTranslations("core.moderation");
  const { report } = data;
  const author = data.authors.at(0);

  return (
    <div className="flex flex-col gap-4 lg:sticky lg:top-24">
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <StatusButton data={data} onDone={onDone} userId={userId} />
        </div>
        <ActionsMenu data={data} onDone={onDone} userId={userId} />
      </div>
      <section
        aria-labelledby="modcp-report-details"
        className="bg-card ring-foreground/5 overflow-hidden rounded-xl shadow-xs ring-1 dark:shadow-none"
      >
        <h2
          className="text-foreground border-b px-4 py-3 text-sm font-semibold"
          id="modcp-report-details"
        >
          {t("modcp.detail.details.title")}
        </h2>
        <div className="px-3 pt-3">
          <ContentCard data={data} typeLabel={typeLabel} />
        </div>
        <dl className="px-4 py-2">
          <FieldRow label={t("modcp.detail.details.plugin")}>
            <span
              className="flex min-w-0 items-center gap-2"
              title={report.pluginId}
            >
              <PuzzleIcon
                aria-hidden
                className="text-muted-foreground size-4 shrink-0"
              />
              <span className="truncate">{pluginName}</span>
            </span>
          </FieldRow>
          <FieldRow label={t("modcp.detail.details.assignee")}>
            <AssigneeField data={data} onDone={onDone} userId={userId} />
          </FieldRow>
          <FieldRow label={t("modcp.detail.details.reporter")}>
            {data.reporter ? (
              <Person link person={data.reporter} />
            ) : (
              <span className="text-muted-foreground">
                {t("modcp.detail.report.deleted_user")}
              </span>
            )}
          </FieldRow>
          {author ? (
            <FieldRow label={t("modcp.detail.details.author")}>
              <Person link person={author} />
            </FieldRow>
          ) : null}
          <FieldRow label={t("modcp.detail.details.reason")}>
            <Chip icon={FlagIcon} tone={REASON_TONE}>
              <ReportReasonLabel code={report.reason} />
            </Chip>
          </FieldRow>
          <FieldRow label={t("modcp.detail.details.visibility")}>
            <Visibility data={data} />
          </FieldRow>
          {report.resolution ? (
            <FieldRow label={t("modcp.detail.details.resolution")}>
              <Chip tone="success">
                {t(`resolutions.${report.resolution}`)}
              </Chip>
            </FieldRow>
          ) : null}
        </dl>
      </section>
      <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 px-1 text-xs">
        <dt>{t("modcp.detail.details.created")}</dt>
        <dd>
          <DateFormat date={report.createdAt} />
        </dd>
        <dt>{t("modcp.detail.details.updated")}</dt>
        <dd>
          <DateFormat date={report.updatedAt} />
        </dd>
        {report.resolvedAt ? (
          <>
            <dt>{t("modcp.detail.details.resolved")}</dt>
            <dd>
              <DateFormat date={report.resolvedAt} />
            </dd>
          </>
        ) : null}
      </dl>
      {!data.permissions.manage ? (
        <p className="text-muted-foreground px-1 text-sm leading-relaxed">
          {t("modcp.detail.read_only")}
        </p>
      ) : null}
    </div>
  );
};
