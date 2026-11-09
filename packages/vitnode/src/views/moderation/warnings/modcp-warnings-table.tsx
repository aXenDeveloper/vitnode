import { cn } from "cn";
import { TriangleAlertIcon } from "lucide-react";
import React from "react";
import { useLocale, useTranslations } from "use-intl";

import type { ColumnDef } from "@/components/table/data-table-content";

import { DateFormat } from "@/components/date-format";
import { ContentDataTable } from "@/components/table/content";
import { useDataTableUrl } from "@/components/table/navigation";
import { richTextToPlainText } from "@/content/rich-text/plain-text";

import type { ModcpWarningsPage } from "./warnings-api";

import { Person } from "../modcp/report-tone";
import { resolveReasonText } from "../report-reasons-query";
import { revealMemberBand, useMemberFilter } from "./modcp-warnings-member";
import { WarningStatusBadge } from "./warning-format";
import {
  RevokeWarningButton,
  StaffNotes,
  WarningFacts,
  WarningRevokedNote,
} from "./warning-list";
import { pickWarningMessage, WarningMessageContent } from "./warning-message";

type WarningRow = ModcpWarningsPage["items"][number];

const MemberCell = ({ row }: { row: WarningRow }) => {
  const t = useTranslations("core.moderation.warn");
  const { setUser, userId } = useMemberFilter();
  const { user } = row;

  return (
    <div className="flex w-44 [&>*]:max-w-full">
      {user ? (
        <button
          aria-label={t("list.show_member", { name: user.name })}
          className="focus-visible:ring-ring/50 flex min-w-0 cursor-pointer rounded-md text-start underline-offset-4 outline-none hover:underline focus-visible:ring-3 [&>*]:max-w-full"
          onClick={event => {
            event.stopPropagation();
            if (user.id === userId) revealMemberBand();
            else setUser(user.id);
          }}
          type="button"
        >
          <Person person={user} size={28} />
        </button>
      ) : (
        <span className="text-muted-foreground">{t("deleted_user")}</span>
      )}
    </div>
  );
};

const ReasonCell = ({ row }: { row: WarningRow }) => {
  const t = useTranslations("core.moderation.warn");
  const locale = useLocale();
  const preview = richTextToPlainText(
    pickWarningMessage(row.message, locale),
  ).replace(/\s+/g, " ");

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-foreground truncate font-medium">
        {row.reason
          ? resolveReasonText(row.reason, locale)
          : t("custom_reason")}
      </span>
      {preview ? (
        <span
          className="text-muted-foreground truncate text-sm"
          title={preview}
        >
          {preview}
        </span>
      ) : null}
    </div>
  );
};

const PointsCell = ({ row }: { row: WarningRow }) => (
  <span
    className={cn(
      "font-medium tabular-nums",
      row.status === "active" ? "text-foreground" : "text-muted-foreground",
      row.status === "revoked" && "line-through",
    )}
  >
    {row.points}
  </span>
);

const ExpandedWarning = ({
  canRevoke,
  warning,
}: {
  canRevoke: boolean;
  warning: WarningRow;
}) => {
  const t = useTranslations("core.moderation.warn");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-1">
          <h3 className="text-muted-foreground text-xs font-medium">
            {t("list.message")}
          </h3>
          <WarningMessageContent
            className="max-w-prose"
            message={warning.message}
          />
        </section>
        <StaffNotes warning={warning} />
        <WarningRevokedNote warning={warning} />
        {canRevoke ? (
          <div>
            <RevokeWarningButton warning={warning} />
          </div>
        ) : null}
      </div>
      <WarningFacts
        className="content-start gap-4 lg:grid-cols-1 xl:grid-cols-2"
        warning={warning}
      />
    </div>
  );
};

export const ModcpWarningsTable = ({
  data,
  header,
  label,
}: {
  data: ModcpWarningsPage;
  header: React.ReactNode;
  label: string;
}) => {
  const t = useTranslations("core.moderation.warn");
  const { isPending } = useDataTableUrl();
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const columns: ColumnDef<WarningRow>[] = [
    {
      cell: ({ row }) => <MemberCell row={row} />,
      className: "whitespace-normal",
      header: t("list.member"),
      id: "member",
    },
    {
      cell: ({ row }) => <ReasonCell row={row} />,
      className: "w-full max-w-0 min-w-48",
      header: t("list.reason"),
      id: "reason",
    },
    {
      accessorKey: "points",
      align: "right",
      cell: ({ row }) => <PointsCell row={row} />,
      className: "w-20",
      header: t("list.points"),
    },
    {
      accessorKey: "status",
      cell: ({ row }) => <WarningStatusBadge status={row.status} />,
      className: "w-28",
      header: t("list.status"),
    },
    {
      accessorKey: "issuedAt",
      cell: ({ row }) => (
        <span className="text-muted-foreground whitespace-nowrap tabular-nums">
          <DateFormat date={row.issuedAt} />
        </span>
      ),
      className: "w-36",
      header: t("list.issued"),
    },
  ];

  return (
    <div
      aria-busy={isPending}
      className={cn(
        "motion-safe:transition-opacity",
        isPending && "opacity-60",
      )}
    >
      <ContentDataTable<WarningRow>
        aria-label={label}
        columns={columns}
        customNoResults={{
          description: t("list.empty_desc"),
          icon: <TriangleAlertIcon aria-hidden="true" />,
          title: t("list.empty_title"),
        }}
        edges={data.items}
        expandable={{
          render: row => (
            <ExpandedWarning
              canRevoke={data.permissions.revoke}
              warning={row}
            />
          ),
        }}
        header={header}
        id="modcp-warnings"
        order={{ defaultOrder: { column: "issuedAt", order: "desc" } }}
        pageInfo={{
          count: data.items.length,
          currentPage: data.page,
          endCursor: null,
          hasNextPage: data.page < totalPages,
          hasPreviousPage: data.page > 1,
          pageSize: data.pageSize,
          startCursor: null,
          totalCount: data.total,
          totalPages,
        }}
      />
    </div>
  );
};
