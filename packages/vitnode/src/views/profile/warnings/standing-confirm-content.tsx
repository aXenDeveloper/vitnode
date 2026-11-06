import { useQueryClient } from "@tanstack/react-query";
import { RotateCcwIcon, ShieldOffIcon } from "lucide-react";
import { toast } from "sonner";
import { useFormatter, useLocale, useNow, useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormTextarea } from "@/components/form/fields/textarea";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WARNING_LIMITS } from "@/lib/moderation/warnings";
import { ReasonFormFooter } from "@/views/moderation/warnings/reason-form-footer";
import {
  ACCOUNT_STATUS_QUERY_KEY,
  revokeSanction,
  revokeWarning,
  WARNINGS_QUERY_ROOT,
} from "@/views/moderation/warnings/warnings-api";

import type { StandingConfirm } from "./standing";

import {
  reasonTextOf,
  SuspensionLength,
  SuspensionNode,
  SuspensionTitle,
  WarningNode,
} from "./standing-parts";

const Subject = ({ confirm }: { confirm: NonNullable<StandingConfirm> }) => {
  const tWarn = useTranslations("core.moderation.warn");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const locale = useLocale();

  if (confirm.kind === "revoke") {
    const { warning } = confirm;

    return (
      <div className="bg-muted/50 flex items-start gap-3 rounded-lg p-3">
        <WarningNode size="sm" warning={warning} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-foreground text-sm font-medium text-pretty">
            {reasonTextOf(warning, locale, tWarn("custom_reason"))}
          </p>
          <p className="text-muted-foreground text-xs">
            {tWarn("points", { count: warning.points })}
            {warning.issuedBy ? ` · ${warning.issuedBy.name}` : null}
            {` · ${format.relativeTime(warning.issuedAt, now)}`}
          </p>
        </div>
      </div>
    );
  }

  const { suspension } = confirm;

  return (
    <div className="bg-muted/50 flex items-start gap-3 rounded-lg p-3">
      <SuspensionNode active={suspension.active} size="sm" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-foreground text-sm font-medium">
          <SuspensionTitle suspension={suspension} />
        </p>
        <p className="text-muted-foreground text-xs">
          <SuspensionLength suspension={suspension} />
        </p>
      </div>
    </div>
  );
};

const StandingConfirmContent = ({
  confirm,
  onClose,
}: {
  confirm: NonNullable<StandingConfirm>;
  onClose: () => void;
}) => {
  const t = useTranslations("core.moderation.profile_card.confirm");
  const tWarn = useTranslations("core.moderation.warn");
  const queryClient = useQueryClient();
  const revoking = confirm.kind === "revoke";
  const formSchema = z.object({
    reason: z
      .string({ error: t("reason_required") })
      .trim()
      .min(WARNING_LIMITS.explanationMinLength, {
        error: t("reason_min", { count: WARNING_LIMITS.explanationMinLength }),
      })
      .max(WARNING_LIMITS.noteMaxLength, {
        error: t("reason_max", { count: WARNING_LIMITS.noteMaxLength }),
      }),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const result =
      confirm.kind === "revoke"
        ? await revokeWarning({ id: confirm.warning.id, reason: values.reason })
        : await revokeSanction({
            id: confirm.suspension.id,
            reason: values.reason,
          });

    if (!result.ok) {
      toast.error(revoking ? t("revoke_failed") : t("lift_failed"), {
        description: tWarn(
          `errors.${result.failure === "conflict" ? "unknown" : result.failure}`,
        ),
      });

      return;
    }

    toast.success(
      revoking ? tWarn("revoke.done") : tWarn("sanctions.lifted_done"),
      {
        description: revoking
          ? tWarn("revoke.done_desc")
          : tWarn("sanctions.lifted_done_desc"),
      },
    );
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: WARNINGS_QUERY_ROOT }),
      queryClient.invalidateQueries({ queryKey: ACCOUNT_STATUS_QUERY_KEY }),
    ]);
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-balance">
          {revoking ? tWarn("revoke.title") : tWarn("sanctions.lift_title")}
        </DialogTitle>
        <DialogDescription className="text-pretty">
          {revoking ? tWarn("revoke.desc") : tWarn("sanctions.lift_desc")}
        </DialogDescription>
      </DialogHeader>
      <Subject confirm={confirm} />
      <AutoForm
        className="flex flex-col gap-4"
        fields={[
          {
            id: "reason",
            component: props => (
              <AutoFormTextarea
                {...props}
                description={t("reason_desc")}
                label={tWarn("revoke.reason")}
              />
            ),
          },
        ]}
        formSchema={formSchema}
        layout={fields => (
          <>
            {fields.reason}
            <ReasonFormFooter>
              {revoking ? (
                <>
                  <RotateCcwIcon aria-hidden="true" />
                  {tWarn("revoke.button")}
                </>
              ) : (
                <>
                  <ShieldOffIcon aria-hidden="true" />
                  {tWarn("sanctions.lift")}
                </>
              )}
            </ReasonFormFooter>
          </>
        )}
        onSubmit={onSubmit}
      />
    </>
  );
};

export default StandingConfirmContent;
