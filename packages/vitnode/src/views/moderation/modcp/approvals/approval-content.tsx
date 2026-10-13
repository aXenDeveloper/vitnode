import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { cn } from "cn";
import { CheckIcon, ExternalLinkIcon, FolderIcon, XIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import type { ApprovalResult } from "../../approval-mutations";
import type { ModcpApprovalDetail, ModcpApprovalStatus } from "../modcp-query";

import { approveSubmission } from "../../approval-mutations";
import { invalidateModcp, modcpApprovalQueryOptions } from "../modcp-query";
import { ModcpPluginMessages } from "../plugin-messages";
import { Person, PersonAvatar, PersonName } from "../report-tone";
import { useApprovalFailure } from "./approval-failure";
import { ComparedFields, isStaleEdit, ProposedFields } from "./approval-fields";
import { approvalTypeLabelKey, useApprovalLabels } from "./approval-labels";
import { ApprovalKindChip, ApprovalStatusChip } from "./approval-tone";

const ApprovalRejectForm = React.lazy(
  async () => await import("./approval-reject-form"),
);

const QUEUE_PATH = "/modcp/approvals";

const DECISION_ALERT: Record<
  Exclude<ModcpApprovalStatus, "pending">,
  "default" | "destructive" | "success"
> = {
  approved: "success",
  cancelled: "default",
  rejected: "destructive",
  superseded: "default",
};

export const ModcpApprovalContent = ({ id }: { id: number }) => {
  const { data } = useSuspenseQuery(modcpApprovalQueryOptions(id));

  return (
    <ModcpPluginMessages labels={[approvalTypeLabelKey(data)]}>
      <ApprovalDetailView id={id} />
    </ModcpPluginMessages>
  );
};

const Section = ({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) => {
  const headingId = React.useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 className="text-foreground text-sm font-semibold" id={headingId}>
        {title}
      </h2>
      {children}
    </section>
  );
};

const containerPathOf = (container: ModcpApprovalDetail["container"]) =>
  container ? [...container.path, container.name].join(" / ") : null;

const DecisionNotice = ({ data }: { data: ModcpApprovalDetail }) => {
  const t = useTranslations("core.moderation.modcp.approvals.detail.decided");

  if (data.status === "pending") return null;

  return (
    <Alert variant={DECISION_ALERT[data.status]}>
      <AlertTitle>{t(`${data.status}.title`)}</AlertTitle>
      <AlertDescription className="flex flex-col gap-1">
        <span className="text-pretty">{t(`${data.status}.desc`)}</span>
        {data.reviewer || data.decidedAt ? (
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
            {data.reviewer ? (
              <PersonName className="text-xs" link person={data.reviewer} />
            ) : null}
            {data.reviewer && data.decidedAt ? (
              <span aria-hidden>·</span>
            ) : null}
            {data.decidedAt ? <DateFormat date={data.decidedAt} /> : null}
          </span>
        ) : null}
        {data.reason ? (
          <span className="text-foreground leading-relaxed break-words whitespace-pre-wrap">
            {t("reason", { reason: data.reason })}
          </span>
        ) : null}
      </AlertDescription>
    </Alert>
  );
};

const PendingWarnings = ({ data }: { data: ModcpApprovalDetail }) => {
  const t = useTranslations("core.moderation.modcp.approvals.detail.warnings");

  if (data.status !== "pending") return null;

  if (!data.record.exists) {
    return (
      <Alert variant="warning">
        <AlertTitle>{t("gone_title")}</AlertTitle>
        <AlertDescription className="text-pretty">
          {t("gone_desc")}
        </AlertDescription>
      </Alert>
    );
  }

  if (data.kind === "edit" && isStaleEdit(data)) {
    return (
      <Alert variant="warning">
        <AlertTitle>{t("stale_title")}</AlertTitle>
        <AlertDescription className="text-pretty">
          {t("stale_desc")}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};

const History = ({ data }: { data: ModcpApprovalDetail }) => {
  const t = useTranslations("core.moderation.modcp.approvals");
  const entries = data.history.filter(entry => entry.id !== data.id);

  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground text-sm leading-relaxed">
        {t("detail.history_empty")}
      </p>
    );
  }

  return (
    <ul className="ring-foreground/10 divide-foreground/10 divide-y overflow-hidden rounded-xl ring-1">
      {entries.map(entry => (
        <li key={entry.id}>
          <Link
            className="hover:bg-muted/50 focus-visible:ring-ring/50 flex items-start gap-3 px-3.5 py-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-inset"
            to={`${QUEUE_PATH}/${entry.id}`}
          >
            {entry.author ? (
              <PersonAvatar
                className="mt-0.5"
                person={entry.author}
                size={28}
              />
            ) : null}
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground tabular-nums">
                  #{entry.id}
                </span>
                <ApprovalKindChip kind={entry.kind} />
                <ApprovalStatusChip status={entry.status} />
              </span>
              <span className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
                {entry.author ? (
                  <>
                    <PersonName className="text-xs" person={entry.author} />
                    <span aria-hidden>·</span>
                  </>
                ) : null}
                <DateFormat date={entry.createdAt} />
              </span>
              {entry.reason ? (
                <span className="text-muted-foreground line-clamp-2 leading-relaxed">
                  {t("reason_preview", { reason: entry.reason })}
                </span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
};

const FieldRow = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) => (
  <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-start gap-3 py-2 text-sm">
    <dt className="text-muted-foreground pt-0.5">{label}</dt>
    <dd className="text-foreground min-w-0 pt-0.5">{children}</dd>
  </div>
);

const Decision = ({ data }: { data: ModcpApprovalDetail }) => {
  const t = useTranslations("core.moderation.modcp.approvals");
  const fail = useApprovalFailure();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [approving, setApproving] = React.useState(false);
  const [rejecting, setRejecting] = React.useState(false);

  const settle = async (
    result: ApprovalResult,
    decision: "approve" | "reject",
  ) => {
    if (fail(result)) {
      if (
        !result.ok &&
        (result.failure === "forbidden" || result.failure === "notFound")
      ) {
        await navigate({ to: QUEUE_PATH });
      }
      await invalidateModcp(queryClient);

      return;
    }

    toast.success(t(`${decision}.success`), {
      description: t(`${decision}.success_desc`, {
        title: data.title ?? t("untitled"),
      }),
    });
    setRejecting(false);
    await navigate({ to: QUEUE_PATH });
    await invalidateModcp(queryClient);
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        className="w-full"
        disabled={!data.record.exists}
        isLoading={approving}
        onClick={async () => {
          setApproving(true);
          try {
            await settle(await approveSubmission({ id: data.id }), "approve");
          } finally {
            setApproving(false);
          }
        }}
      >
        <CheckIcon aria-hidden />
        {t("approve.button")}
      </Button>
      <Button
        className="w-full"
        onClick={() => {
          setRejecting(true);
        }}
        variant="destructive"
      >
        <XIcon aria-hidden />
        {t("reject.button")}
      </Button>

      <Dialog onOpenChange={setRejecting} open={rejecting}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-balance">
              {t("reject.title")}
            </DialogTitle>
            <DialogDescription className="text-pretty">
              {t("reject.desc")}
            </DialogDescription>
          </DialogHeader>
          <React.Suspense
            fallback={
              <div className="flex flex-col gap-3">
                <Skeleton className="h-28 w-full" />
                <Skeleton className="ms-auto h-9 w-32" />
              </div>
            }
          >
            <ApprovalRejectForm
              id={data.id}
              onSettled={async result => {
                await settle(result, "reject");
              }}
            />
          </React.Suspense>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Sidebar = ({
  data,
  typeLabel,
}: {
  data: ModcpApprovalDetail;
  typeLabel: string;
}) => {
  const t = useTranslations("core.moderation.modcp.approvals.detail");
  const containerPath = containerPathOf(data.container);

  return (
    <div className="flex flex-col gap-4 lg:sticky lg:top-24">
      {data.status === "pending" ? <Decision data={data} /> : null}

      <section
        aria-labelledby="modcp-approval-details"
        className="bg-card ring-foreground/5 overflow-hidden rounded-xl shadow-xs ring-1 dark:shadow-none"
      >
        <h2
          className="text-foreground border-b px-4 py-3 text-sm font-semibold"
          id="modcp-approval-details"
        >
          {t("details.title")}
        </h2>
        <dl className="px-4 py-2">
          <FieldRow label={t("details.author")}>
            {data.author ? (
              <Person link person={data.author} />
            ) : (
              <span className="text-muted-foreground">
                {t("details.deleted_user")}
              </span>
            )}
          </FieldRow>
          <FieldRow label={t("details.type")}>{typeLabel}</FieldRow>
          {containerPath ? (
            <FieldRow label={t("details.container")}>
              <span className="flex min-w-0 items-start gap-1.5">
                <FolderIcon
                  aria-hidden
                  className="text-muted-foreground mt-0.5 size-4 shrink-0"
                />
                <span className="break-words">{containerPath}</span>
              </span>
            </FieldRow>
          ) : null}
          <FieldRow label={t("details.kind")}>
            <ApprovalKindChip kind={data.kind} />
          </FieldRow>
          <FieldRow label={t("details.status")}>
            <ApprovalStatusChip status={data.status} />
          </FieldRow>
          {data.reviewer ? (
            <FieldRow label={t("details.reviewer")}>
              <Person link person={data.reviewer} />
            </FieldRow>
          ) : null}
        </dl>
      </section>

      <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 px-1 text-xs">
        <dt>{t("details.submitted")}</dt>
        <dd>
          <DateFormat date={data.createdAt} />
        </dd>
        {data.decidedAt ? (
          <>
            <dt>{t("details.decided")}</dt>
            <dd>
              <DateFormat date={data.decidedAt} />
            </dd>
          </>
        ) : null}
      </dl>

      {data.record.exists && data.record.url ? (
        <a
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
          href={data.record.url}
          rel="noopener"
          target="_blank"
        >
          <ExternalLinkIcon aria-hidden />
          {t(data.record.public ? "view_live" : "view_draft")}
          <span className="sr-only">{t("new_tab")}</span>
        </a>
      ) : null}
    </div>
  );
};

const ApprovalDetailView = ({ id }: { id: number }) => {
  const t = useTranslations("core.moderation.modcp.approvals");
  const { data } = useSuspenseQuery(modcpApprovalQueryOptions(id));
  const labels = useApprovalLabels();
  const typeLabel = labels.type(data);
  const containerPath = containerPathOf(data.container);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ApprovalKindChip kind={data.kind} />
          <ApprovalStatusChip status={data.status} />
        </div>
        <h1
          className={cn(
            "text-2xl font-semibold tracking-tight text-balance break-words",
            data.title ? "text-foreground" : "text-muted-foreground italic",
          )}
        >
          {data.title ?? t("untitled")}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {containerPath
            ? t("detail.subtitle_in", {
                container: containerPath,
                type: typeLabel,
              })
            : t("detail.subtitle", { type: typeLabel })}
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article className="bg-card ring-foreground/5 flex min-w-0 flex-col gap-8 rounded-xl p-4 shadow-xs ring-1 md:p-6 dark:shadow-none">
          <DecisionNotice data={data} />
          <PendingWarnings data={data} />

          {data.kind === "edit" && data.current ? (
            <Section title={t("detail.sections.changes")}>
              <ComparedFields
                current={data.current}
                data={data}
                values={data.values}
              />
            </Section>
          ) : (
            <Section title={t("detail.sections.proposed")}>
              <ProposedFields data={data} values={data.values} />
            </Section>
          )}

          <Section title={t("detail.sections.history")}>
            <History data={data} />
          </Section>
        </article>

        <Sidebar data={data} typeLabel={typeLabel} />
      </div>
    </div>
  );
};
