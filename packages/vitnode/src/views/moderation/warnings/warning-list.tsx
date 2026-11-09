import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import {
  ExternalLinkIcon,
  FlagIcon,
  LockIcon,
  ShieldOffIcon,
  Undo2Icon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import { DateFormat } from "@/components/date-format";
import { AutoForm } from "@/components/form/auto-form";
import { AutoFormTextarea } from "@/components/form/fields/textarea";
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

import { Person, PersonAvatar, PersonName } from "../modcp/report-tone";
import { ReasonFormFooter } from "./reason-form-footer";
import { WarningNoteContent } from "./warning-message";
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
          layout={fields => (
            <>
              {fields.reason}
              <ReasonFormFooter>
                <Undo2Icon aria-hidden="true" />
                {submitLabel}
              </ReasonFormFooter>
            </>
          )}
          onSubmit={onSubmit}
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

const InlinePersonOrDeleted = ({ person }: { person: null | ReportPerson }) => {
  const t = useTranslations("core.moderation.warn");
  if (!person) return <>{t("deleted_user")}</>;

  return (
    <span className="whitespace-nowrap">
      <PersonAvatar
        className="me-1 inline align-text-bottom"
        person={person}
        size={16}
      />
      <PersonName className="items-baseline gap-1" link person={person} />
    </span>
  );
};

export const WarningFacts = ({
  className,
  warning,
}: {
  className?: string;
  warning: ModcpStaffWarning;
}) => {
  const t = useTranslations("core.moderation.warn");

  return (
    <dl className={cn("grid gap-3 sm:grid-cols-2", className)}>
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
export const StaffNotes = ({ warning }: { warning: ModcpStaffWarning }) => {
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
          <WarningNoteContent note={warning.staffNote} />
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

export const WarningRevokedNote = ({
  warning,
}: {
  warning: ModcpStaffWarning;
}) => {
  const t = useTranslations("core.moderation.warn");
  const { revokedAt } = warning;
  if (!revokedAt) return null;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {t.rich("list.revoked", {
          by: () => <InlinePersonOrDeleted person={warning.revokedBy} />,
          date: () => <DateFormat date={revokedAt} />,
        })}
        {warning.revokeReason ? ` ${warning.revokeReason}` : null}
      </p>
      {warning.sanctionId ? (
        <p className="text-muted-foreground text-sm text-pretty">
          {t("list.sanction_stays")}
        </p>
      ) : null}
    </div>
  );
};

export const RevokeWarningButton = ({
  warning,
}: {
  warning: ModcpStaffWarning;
}) => {
  const t = useTranslations("core.moderation.warn");
  const [revoking, setRevoking] = React.useState(false);
  if (warning.status === "revoked") return null;

  return (
    <>
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
      <RevokeDialog
        description={t("revoke.desc")}
        onClose={() => {
          setRevoking(false);
        }}
        onRevoke={async reason =>
          await revokeWarning({ id: warning.id, reason })
        }
        open={revoking}
        submitLabel={t("revoke.button")}
        success={t("revoke.done")}
        successDesc={t("revoke.done_desc")}
        title={t("revoke.title")}
      />
    </>
  );
};

export const LiftSanctionButton = ({
  sanction,
}: {
  sanction: ModcpSanction;
}) => {
  const t = useTranslations("core.moderation.warn");
  const [lifting, setLifting] = React.useState(false);

  return (
    <>
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
    </>
  );
};
