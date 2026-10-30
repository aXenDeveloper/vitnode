import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ExternalLinkIcon,
  FlagIcon,
  LockIcon,
  ShieldOffIcon,
  Undo2Icon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import { DateFormat } from "@/components/date-format";
import { AutoForm } from "@/components/form/auto-form";
import { AutoFormTextarea } from "@/components/form/fields/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WARNING_LIMITS } from "@/lib/moderation/warnings";

import type { ReportPerson } from "../modcp/report-tone";
import type {
  ModcpSanction,
  ModcpStaffWarning,
  WarningResult,
} from "./warnings-api";

import { Person } from "../modcp/report-tone";
import { resolveReasonText } from "../report-reasons-query";
import { SanctionSummary } from "./warn-dialog-content";
import { WarningDuration, WarningStatusBadge } from "./warning-format";
import {
  ACCOUNT_STATUS_QUERY_KEY,
  revokeSanction,
  revokeWarning,
  WARNINGS_QUERY_ROOT,
} from "./warnings-api";

const RevokeDialog = ({
  description,
  onClose,
  onRevoke,
  open,
  submitLabel,
  success,
  successDesc,
  title,
}: {
  description: string;
  onClose: () => void;
  onRevoke: (reason: string) => Promise<WarningResult<unknown>>;
  open: boolean;
  submitLabel: string;
  success: string;
  successDesc: string;
  title: string;
}) => {
  const t = useTranslations("core.moderation.warn");
  const queryClient = useQueryClient();
  const formSchema = z.object({
    reason: z
      .string()
      .trim()
      .min(WARNING_LIMITS.explanationMinLength)
      .max(WARNING_LIMITS.noteMaxLength),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const result = await onRevoke(values.reason);
    if (!result.ok) {
      toast.error(t("errors.title"), {
        description: t(
          `errors.${result.failure === "conflict" ? "unknown" : result.failure}`,
        ),
      });

      return;
    }
    toast.success(success, { description: successDesc });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: WARNINGS_QUERY_ROOT }),
      queryClient.invalidateQueries({ queryKey: ACCOUNT_STATUS_QUERY_KEY }),
    ]);
    onClose();
  };

  return (
    <Dialog
      onOpenChange={next => {
        if (!next) onClose();
      }}
      open={open}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-balance">{title}</DialogTitle>
          <DialogDescription className="text-pretty">
            {description}
          </DialogDescription>
        </DialogHeader>
        <AutoForm
          className="flex flex-col gap-4"
          fields={[
            {
              id: "reason",
              component: props => (
                <AutoFormTextarea
                  {...props}
                  description={t("revoke.reason_desc")}
                  label={t("revoke.reason")}
                />
              ),
            },
          ]}
          formSchema={formSchema}
          onSubmit={onSubmit}
          submitButtonProps={{
            children: (
              <>
                <Undo2Icon aria-hidden="true" />
                {submitLabel}
              </>
            ),
          }}
        />
      </DialogContent>
    </Dialog>
  );
};

const Detail = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) => (
  <div className="flex flex-col gap-0.5">
    <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
    <dd className="text-foreground text-sm leading-relaxed break-words">
      {children}
    </dd>
  </div>
);

const PersonOrDeleted = ({ person }: { person: null | ReportPerson }) => {
  const t = useTranslations("core.moderation.warn");

  return person ? <Person link person={person} /> : <>{t("deleted_user")}</>;
};

/** Who, when, what for: the facts of one warning. */
const WarningFacts = ({
  member,
  warning,
}: {
  member?: null | ReportPerson;
  warning: ModcpStaffWarning;
}) => {
  const t = useTranslations("core.moderation.warn");

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {member !== undefined ? (
        <Detail label={t("list.member")}>
          {member ? (
            <Link
              className="hover:bg-muted/50 focus-visible:ring-ring/50 -mx-1 inline-flex rounded-md px-1 outline-none focus-visible:ring-3"
              to={`/modcp/members/${member.id}`}
            >
              <Person person={member} />
            </Link>
          ) : (
            <PersonOrDeleted person={member} />
          )}
        </Detail>
      ) : null}
      <Detail label={t("list.issued_by")}>
        <PersonOrDeleted person={warning.issuedBy} />
      </Detail>
      <Detail label={t("list.expires")}>
        {warning.expiresAt ? (
          <DateFormat date={warning.expiresAt} showFullDate />
        ) : (
          t("list.never")
        )}
      </Detail>
      {warning.defaultPoints !== null &&
      warning.defaultPoints !== warning.points ? (
        <Detail label={t("list.default_points")}>
          {t("points", { count: warning.defaultPoints })}
        </Detail>
      ) : null}
      {warning.content ? (
        <Detail label={t("list.content")}>
          {warning.content.url ? (
            <a
              className="text-primary inline-flex items-center gap-1 underline-offset-4 hover:underline"
              href={warning.content.url}
            >
              {warning.content.title ?? t("list.untitled")}
              <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
            </a>
          ) : (
            (warning.content.title ?? t("list.untitled"))
          )}
        </Detail>
      ) : null}
      {warning.reportId ? (
        <Detail label={t("list.report")}>
          <Link
            className="text-primary inline-flex items-center gap-1 underline-offset-4 hover:underline"
            to={`/modcp/reports/${warning.reportId}`}
          >
            <FlagIcon aria-hidden="true" className="size-3.5" />
            {t("list.report_link", { id: warning.reportId })}
          </Link>
        </Detail>
      ) : null}
    </dl>
  );
};

/** Staff notes and override explanations - `null` from the API unless the moderator may read them. */
const StaffNotes = ({ warning }: { warning: ModcpStaffWarning }) => {
  const t = useTranslations("core.moderation.warn");
  if (!warning.staffNote && !warning.overrideNote) return null;

  return (
    <div className="bg-muted/60 flex flex-col gap-3 rounded-lg p-3">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
        <LockIcon aria-hidden="true" className="size-3.5" />
        {t("list.staff_only")}
      </p>
      {warning.staffNote ? (
        <Detail label={t("list.staff_note")}>
          <span className="whitespace-pre-wrap">{warning.staffNote}</span>
        </Detail>
      ) : null}
      {warning.overrideNote ? (
        <Detail label={t("list.override_note")}>
          <span className="whitespace-pre-wrap">{warning.overrideNote}</span>
        </Detail>
      ) : null}
    </div>
  );
};

/** One warning as staff see it, with Revoke when allowed. */
export const StaffWarningCard = ({
  canRevoke,
  member,
  warning,
}: {
  canRevoke: boolean;
  /** Shown in lists that mix members. */
  member?: null | ReportPerson;
  warning: ModcpStaffWarning;
}) => {
  const t = useTranslations("core.moderation.warn");
  const locale = useLocale();
  const [revoking, setRevoking] = React.useState(false);
  const reason = warning.reason
    ? resolveReasonText(warning.reason, locale)
    : t("custom_reason");
  const titleId = React.useId();
  const { revokedAt } = warning;

  return (
    <article
      aria-labelledby={titleId}
      className="bg-card ring-foreground/5 flex flex-col gap-4 rounded-xl p-4 shadow-xs ring-1 dark:shadow-none"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3
            className="text-foreground font-semibold text-balance"
            id={titleId}
          >
            {reason}
          </h3>
          <p className="text-muted-foreground text-sm">
            <DateFormat date={warning.issuedAt} />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {t("points", { count: warning.points })}
          </Badge>
          <WarningStatusBadge status={warning.status} />
          {canRevoke && warning.status !== "revoked" ? (
            <Button
              onClick={() => {
                setRevoking(true);
              }}
              size="sm"
              variant="outline"
            >
              <Undo2Icon aria-hidden="true" />
              {t("revoke.button")}
            </Button>
          ) : null}
        </div>
      </header>

      <WarningFacts member={member} warning={warning} />

      <Detail label={t("list.message")}>
        <span className="whitespace-pre-wrap">{warning.message}</span>
      </Detail>

      <StaffNotes warning={warning} />

      {revokedAt ? (
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t.rich("list.revoked", {
            by: () => <PersonOrDeleted person={warning.revokedBy} />,
            date: () => <DateFormat date={revokedAt} />,
          })}
          {warning.revokeReason ? ` ${warning.revokeReason}` : null}
        </p>
      ) : null}

      {warning.sanctionId && revokedAt ? (
        <p className="text-muted-foreground text-sm text-pretty">
          {t("list.sanction_stays")}
        </p>
      ) : null}

      <RevokeDialog
        description={t("revoke.desc")}
        onClose={() => {
          setRevoking(false);
        }}
        onRevoke={async reasonText =>
          await revokeWarning({ id: warning.id, reason: reasonText })
        }
        open={revoking}
        submitLabel={t("revoke.button")}
        success={t("revoke.done")}
        successDesc={t("revoke.done_desc")}
        title={t("revoke.title")}
      />
    </article>
  );
};

/** One suspension, with Lift when allowed. */
export const SanctionCard = ({
  canManage,
  sanction,
}: {
  canManage: boolean;
  sanction: ModcpSanction;
}) => {
  const t = useTranslations("core.moderation.warn");
  const [lifting, setLifting] = React.useState(false);
  const { revokedAt } = sanction;

  return (
    <article className="bg-card ring-foreground/5 flex flex-col gap-3 rounded-xl p-4 shadow-xs ring-1 dark:shadow-none">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-foreground font-semibold text-balance">
            {sanction.endsAt
              ? t("sanctions.temporary")
              : t("sanctions.indefinite")}
          </h3>
          <p className="text-muted-foreground text-sm">
            <DateFormat date={sanction.startsAt} />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              sanction.active
                ? "destructive"
                : sanction.revokedAt
                  ? "outline"
                  : "secondary"
            }
          >
            {sanction.active
              ? t("sanctions.active")
              : sanction.revokedAt
                ? t("sanctions.lifted")
                : t("sanctions.ended")}
          </Badge>
          {canManage && sanction.active ? (
            <Button
              onClick={() => {
                setLifting(true);
              }}
              size="sm"
              variant="outline"
            >
              <ShieldOffIcon aria-hidden="true" />
              {t("sanctions.lift")}
            </Button>
          ) : null}
        </div>
      </header>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Detail label={t("sanctions.ends")}>
          <SanctionSummary
            sanction={{
              durationHours: sanction.threshold?.durationHours,
              endsAt: sanction.endsAt,
            }}
          />
        </Detail>
        <Detail label={t("sanctions.source")}>
          {sanction.threshold
            ? t("sanctions.from_threshold", {
                points: sanction.threshold.points,
              })
            : t("sanctions.manual")}
          {sanction.threshold?.durationHours ? (
            <>
              {" "}
              (<WarningDuration hours={sanction.threshold.durationHours} />)
            </>
          ) : null}
        </Detail>
      </dl>
      {revokedAt ? (
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t.rich("list.lifted", {
            by: () => <PersonOrDeleted person={sanction.revokedBy} />,
            date: () => <DateFormat date={revokedAt} />,
          })}
          {sanction.revokeReason ? ` ${sanction.revokeReason}` : null}
        </p>
      ) : null}
      <RevokeDialog
        description={t("sanctions.lift_desc")}
        onClose={() => {
          setLifting(false);
        }}
        onRevoke={async reason =>
          await revokeSanction({ id: sanction.id, reason })
        }
        open={lifting}
        submitLabel={t("sanctions.lift")}
        success={t("sanctions.lifted_done")}
        successDesc={t("sanctions.lifted_done_desc")}
        title={t("sanctions.lift_title")}
      />
    </article>
  );
};
