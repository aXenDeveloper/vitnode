import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { CheckIcon, PanelRightOpenIcon, UserXIcon, XIcon } from "lucide-react";
import React from "react";
import { useNow, useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { ContentDataTable } from "@/components/table/content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TooltipWithContent } from "@/components/ui/tooltip";

import type { AccountDeletionActionsProps } from "./deletions-actions";
import type { AccountDeletion, AccountDeletionsPage } from "./deletions-query";

import { AccountDeletionActions } from "./deletions-actions";
import { deletionRef } from "./deletions-attention";
import { ACCOUNT_DELETION_STATUSES } from "./deletions-query";

const STATUS_VARIANT = {
  cancelled: "secondary",
  completed: "success",
  failed: "destructive",
  pending: "warning",
} as const;

const isOpen = (row: AccountDeletion) =>
  row.status === "pending" || row.status === "failed";

const Member = ({ row }: { row: AccountDeletion }) => {
  const t = useTranslations("admin.user.deletions");

  return row.user ? (
    <Link
      className="text-foreground font-medium break-words underline-offset-4 hover:underline"
      to={`/admin/core/users/${row.user.id}`}
    >
      {row.user.name}
    </Link>
  ) : (
    <span className="text-muted-foreground">
      {t("erased_member", { id: row.erasedUserId })}
    </span>
  );
};

type StepTone = "bad" | "done" | "next" | "now";

const Step = ({
  children,
  title,
  tone,
}: {
  children: React.ReactNode;
  title: string;
  tone: StepTone;
}) => (
  <li className="group flex gap-3">
    <span aria-hidden className="flex flex-col items-center gap-1">
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border-2 [&_svg]:size-3",
          tone === "done" && "border-success bg-success text-background",
          tone === "bad" && "border-destructive bg-destructive text-background",
          tone === "now" && "border-warn",
          tone === "next" && "border-border",
        )}
      >
        {tone === "done" ? <CheckIcon /> : tone === "bad" ? <XIcon /> : null}
      </span>
      <span className="bg-border w-0.5 flex-1 rounded-full group-last:hidden" />
    </span>
    <span className="flex min-w-0 flex-col pb-4 text-sm leading-relaxed group-last:pb-0">
      <span className="font-medium">{title}</span>
      <span className="text-muted-foreground">{children}</span>
    </span>
  </li>
);

const Timeline = ({ row }: { row: AccountDeletion }) => {
  const t = useTranslations("admin.user.deletions.timeline");
  const now = useNow({ updateInterval: 60_000 });
  const overdue = new Date(row.scheduledAt).getTime() < now.getTime();

  return (
    <ol aria-label={t("label")} className="m-0 flex list-none flex-col p-0">
      <Step title={t("requested")} tone="done">
        <DateFormat date={row.createdAt} showFullDate />
        {row.requestedBy ? ` · ${row.requestedBy.name}` : null}
      </Step>
      {row.status === "cancelled" && row.cancelledAt ? (
        <Step title={t("cancelled")} tone="done">
          <DateFormat date={row.cancelledAt} showFullDate />
        </Step>
      ) : null}
      {row.status === "completed" && row.completedAt ? (
        <Step title={t("erased")} tone="done">
          <DateFormat date={row.completedAt} showFullDate /> ·{" "}
          {t("files", { deleted: row.filesDeleted, kept: row.filesKept })}
        </Step>
      ) : null}
      {row.status === "failed" ? (
        <Step title={t("failed", { count: row.attempts })} tone="bad">
          {t("failed_desc")}
        </Step>
      ) : null}
      {row.status === "pending" ? (
        <>
          <Step title={t("grace")} tone={overdue ? "done" : "now"}>
            <DateFormat date={row.scheduledAt} showFullDate />
          </Step>
          <Step title={t("erase")} tone={overdue ? "now" : "next"}>
            {overdue ? t("erase_waiting") : t("erase_after")}
          </Step>
        </>
      ) : null}
    </ol>
  );
};

const DeletionFacts = ({ row }: { row: AccountDeletion }) => {
  const t = useTranslations("admin.user.deletions");
  const facts = [
    [t("details.requested_by"), row.requestedBy?.name ?? t("details.member")],
    [t("details.attempts"), String(row.attempts)],
    [
      t("details.files"),
      row.status === "completed"
        ? t("files", { deleted: row.filesDeleted, kept: row.filesKept })
        : "—",
    ],
    [t("details.member_id"), `#${row.erasedUserId}`],
  ];

  return (
    <dl className="m-0 grid grid-cols-2 gap-2">
      {facts.map(([label, value]) => (
        <div
          className="bg-muted flex min-w-0 flex-col gap-0.5 rounded-md px-3 py-2"
          key={label}
        >
          <dt className="text-muted-foreground text-xs">{label}</dt>
          <dd className="m-0 text-sm font-medium break-words tabular-nums">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
};

const DeletionSheet = ({
  canDelete,
  onCancel,
  onErase,
  onOpenChange,
  row,
}: AccountDeletionActionsProps & {
  canDelete: boolean;
  onOpenChange: (open: boolean) => void;
  row: AccountDeletion | null;
}) => {
  const t = useTranslations("admin.user.deletions");

  return (
    <Sheet onOpenChange={onOpenChange} open={row !== null}>
      <SheetContent className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        {row ? (
          <>
            <SheetHeader className="border-b">
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[row.status]}>
                  {t(`status.${row.status}`)}
                </Badge>
                <span className="text-muted-foreground font-mono text-xs">
                  {deletionRef(row.id)}
                </span>
              </div>
              <SheetTitle className="break-words">
                {row.user?.name ?? t("erased_member", { id: row.erasedUserId })}
              </SheetTitle>
              <SheetDescription>
                {t(row.source === "admin" ? "source.admin" : "source.user")}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-5">
              <DeletionFacts row={row} />
              <Timeline row={row} />
              {row.lastError && isOpen(row) ? (
                <p
                  className="text-destructive m-0 text-sm leading-relaxed break-words"
                  role="alert"
                >
                  {row.lastError}
                </p>
              ) : null}
            </div>
            {canDelete && isOpen(row) ? (
              <SheetFooter className="border-t">
                <AccountDeletionActions
                  deletionId={row.id}
                  onCancel={onCancel}
                  onErase={onErase}
                  size="default"
                  status={row.status === "failed" ? "failed" : "pending"}
                />
              </SheetFooter>
            ) : null}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};

export const AccountDeletionsTable = ({
  canDelete,
  data,
  onCancel,
  onErase,
}: AccountDeletionActionsProps & {
  canDelete: boolean;
  data: AccountDeletionsPage;
}) => {
  const t = useTranslations("admin.user.deletions");
  const [openId, setOpenId] = React.useState<null | number>(null);
  const open = data.edges.find(row => row.id === openId) ?? null;

  return (
    <>
      <ContentDataTable<AccountDeletion>
        columns={[
          {
            accessorKey: "id",
            header: t("columns.request"),
            cell: ({ row }) => (
              <span className="text-muted-foreground font-mono text-xs whitespace-nowrap">
                {deletionRef(row.id)}
              </span>
            ),
          },
          {
            id: "member",
            header: t("columns.member"),
            cell: ({ row }) => <Member row={row} />,
          },
          {
            accessorKey: "status",
            header: t("columns.status"),
            cell: ({ row }) => (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <Badge variant={STATUS_VARIANT[row.status]}>
                  {t(`status.${row.status}`)}
                </Badge>
                {row.status === "failed" ? (
                  <span className="text-muted-foreground text-xs tabular-nums">
                    ×{row.attempts}
                  </span>
                ) : null}
              </span>
            ),
          },
          {
            id: "requestedBy",
            header: t("columns.requested_by"),
            cell: ({ row }) => (
              <span className="text-muted-foreground">
                {row.source === "admin"
                  ? (row.requestedBy?.name ?? t("source.admin"))
                  : t("details.member")}
              </span>
            ),
          },
          {
            accessorKey: "createdAt",
            header: t("columns.requested"),
            cell: ({ row }) => <DateFormat date={row.createdAt} />,
          },
          {
            accessorKey: "scheduledAt",
            header: t("columns.due"),
            cell: ({ row }) => {
              const closed = row.completedAt ?? row.cancelledAt;

              return (
                <span className="whitespace-nowrap">
                  <DateFormat date={closed ?? row.scheduledAt} />
                </span>
              );
            },
          },
          {
            id: "actions",
            header: "",
            align: "right",
            cell: ({ row }) => (
              <TooltipWithContent text={t("details.open")}>
                <Button
                  aria-label={t("details.open_label", {
                    ref: deletionRef(row.id),
                  })}
                  onClick={() => setOpenId(row.id)}
                  size="icon"
                  variant="ghost"
                >
                  <PanelRightOpenIcon />
                </Button>
              </TooltipWithContent>
            ),
          },
        ]}
        customNoResults={{
          description: t("empty.desc"),
          icon: <UserXIcon />,
          title: t("empty.title"),
        }}
        edges={data.edges}
        filters={[
          {
            id: "status",
            label: t("columns.status"),
            options: ACCOUNT_DELETION_STATUSES.map(status => ({
              label: t(`status.${status}`),
              value: status,
            })),
          },
        ]}
        id="account-deletions-table"
        order={{
          columns: ["createdAt", "scheduledAt"],
          defaultOrder: { column: "createdAt", order: "desc" },
        }}
        pageInfo={data.pageInfo}
        search
        searchPlaceholder={t("search")}
      />
      <DeletionSheet
        canDelete={canDelete}
        onCancel={onCancel}
        onErase={onErase}
        onOpenChange={next => {
          if (!next) setOpenId(null);
        }}
        row={open}
      />
    </>
  );
};
