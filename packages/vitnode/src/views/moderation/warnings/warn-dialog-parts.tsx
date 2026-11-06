import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { ArrowRightIcon, PencilLineIcon } from "lucide-react";
import React from "react";
import { useFormatter, useLocale, useNow, useTranslations } from "use-intl";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { MultiLangValue } from "@/lib/helpers/multi-lang";
import type { WarningMessage } from "@/lib/moderation/warnings";

import { Avatar } from "@/components/avatar";
import { FEEDBACK_TONE_TEXT } from "@/components/ui/feedback-tone";
import { FormControl, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SlidingNumber } from "@/components/ui/sliding-number";
import {
  isRichTextDocument,
  isRichTextEmpty,
} from "@/content/rich-text/document";
import { richTextToPlainText } from "@/content/rich-text/plain-text";
import {
  activeSuspensionOf,
  standingFromModcp,
} from "@/views/profile/warnings/standing";
import {
  reasonTextOf,
  WarningNode,
} from "@/views/profile/warnings/standing-parts";

import type { ModcpWarningReason, WarningPreview } from "./warnings-api";

import { resolveReasonText } from "../report-reasons-query";
import { WarningDuration } from "./warning-format";
import { SanctionSummary } from "./warning-sanction";
import { memberStandingQueryOptions } from "./warnings-api";

export const NO_REASON = "none";

export interface DocumentDraft {
  [key: string]: unknown;
  content?: unknown[];
  type: "doc";
}

export type MessageDraft = MultiLangValue<DocumentDraft | null>;

const RECENT_WARNINGS = 3;

const textToDocument =(text: string): DocumentDraft => ({
  content: text
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => ({
      content: block
        .split("\n")
        .flatMap((line, index) => [
          ...(index > 0 ? [{ type: "hardBreak" }] : []),
          ...(line ? [{ text: line, type: "text" }] : []),
        ]),
      type: "paragraph",
    })),
  type: "doc",
});

export const reasonMessage = (
  reason: ModcpWarningReason | undefined,
): MessageDraft =>
  (reason?.message ?? [])
    .filter(item => item.value.trim() !== "")
    .map(item => ({
      languageCode: item.languageCode,
      value: textToDocument(item.value),
    }));

export const filledMessage = (
  message: MessageDraft | undefined,
): WarningMessage =>
  (message ?? []).flatMap(item =>
    isRichTextDocument(item.value) && !isRichTextEmpty(item.value)
      ? [{ languageCode: item.languageCode, value: item.value }]
      : [],
  );

export const messageText = (message: MessageDraft | undefined) =>
  filledMessage(message)
    .map(item => `${item.languageCode}:${richTextToPlainText(item.value)}`)
    .sort()
    .join("\n");

const CustomReasonIcon = () => (
  <span
    aria-hidden="true"
    className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full"
  >
    <PencilLineIcon className="size-4" />
  </span>
);

const ReasonText = ({
  description,
  meta,
  title,
}: {
  description?: string;
  meta: React.ReactNode;
  title: string;
}) => (
  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
    <span className="text-foreground text-sm leading-snug font-medium text-pretty">
      {title}
    </span>
    {description ? (
      <span className="text-muted-foreground line-clamp-2 text-xs leading-relaxed text-pretty">
        {description}
      </span>
    ) : null}
    <span className="text-muted-foreground text-xs">{meta}</span>
  </span>
);

export const ReasonPicker = ({
  field,
  label,
  onReason,
  reasons,
}: ItemAutoFormComponentProps & {
  onReason: (reason: ModcpWarningReason | undefined) => void;
  reasons: ModcpWarningReason[];
}) => {
  const t = useTranslations("core.moderation.warn");
  const locale = useLocale();
  const labelId = React.useId();
  const reasonOf = (value: unknown) =>
    reasons.find(reason => String(reason.id) === String(value));
  const expiryOf = ({
    expiresAfterHours,
  }: ModcpWarningReason): React.ReactNode =>
    expiresAfterHours === null
      ? t("form.never_expires")
      : t.rich("form.expires_after", {
          duration: () => <WarningDuration hours={expiresAfterHours} />,
        });

  const custom = (
    <span className="flex items-start gap-3">
      <CustomReasonIcon />
      <ReasonText
        meta={t("form.custom_reason_desc")}
        title={t("custom_reason")}
      />
    </span>
  );

  return (
    <>
      <p className="text-foreground text-sm font-medium" id={labelId}>
        {label}
      </p>
      <Select
        onValueChange={value => {
          onReason(reasonOf(value));
          field.onChange(String(value));
        }}
        value={field.value ?? null}
      >
        <FormControl>
          <SelectTrigger
            aria-labelledby={labelId}
            className="w-full py-2.5 text-start whitespace-normal data-[size=default]:h-auto *:data-[slot=select-value]:line-clamp-none"
            onBlur={field.onBlur}
          >
            <SelectValue>
              {(value: unknown) => {
                const reason = reasonOf(value);

                return reason ? (
                  <span className="flex items-start gap-3">
                    <WarningNode
                      size="sm"
                      warning={{ points: reason.points, status: "active" }}
                    />
                    <ReasonText
                      meta={expiryOf(reason)}
                      title={resolveReasonText(reason.title, locale)}
                    />
                  </span>
                ) : (
                  custom
                );
              }}
            </SelectValue>
          </SelectTrigger>
        </FormControl>
        <SelectContent className="max-h-96 w-(--anchor-width)">
          {reasons.map(reason => (
            <SelectItem
              className="items-start py-2.5"
              key={reason.id}
              value={String(reason.id)}
            >
              <span className="flex items-start gap-3">
                <WarningNode
                  size="sm"
                  warning={{ points: reason.points, status: "active" }}
                />
                <ReasonText
                  description={resolveReasonText(reason.description, locale)}
                  meta={expiryOf(reason)}
                  title={resolveReasonText(reason.title, locale)}
                />
              </span>
            </SelectItem>
          ))}
          {reasons.length > 0 ? <SelectSeparator /> : null}
          <SelectItem className="items-start py-2.5" value={NO_REASON}>
            {custom}
          </SelectItem>
        </SelectContent>
      </Select>
      <FormMessage />
    </>
  );
};

export const MemberPanel = ({ preview }: { preview: WarningPreview }) => {
  const t = useTranslations("core.moderation.warn.dossier");
  const tCard = useTranslations("core.moderation.profile_card");
  const tWarn = useTranslations("core.moderation.warn");
  const format = useFormatter();
  const locale = useLocale();
  const now = useNow({ updateInterval: 60_000 });
  const headingId = React.useId();
  const { user } = preview;
  const query = useQuery({
    ...memberStandingQueryOptions(user.id),
    enabled: preview.permissions.viewWarnings,
  });
  const standing = query.data ? standingFromModcp(query.data) : null;
  const suspension = standing ? activeSuspensionOf(standing) : null;
  const recent = standing?.warnings.slice(0, RECENT_WARNINGS) ?? [];
  const older = (standing?.warnings.length ?? 0) - recent.length;
  const suspendedUntil = suspension?.endsAt ?? preview.suspendedUntil?.endsAt;
  const suspended = !!suspension || !!preview.suspendedUntil;

  return (
    <aside
      aria-label={t("label", { name: user.name })}
      className="bg-muted/50 flex flex-col gap-6 border-b p-6 md:border-e md:border-b-0"
    >
      <div className="flex items-center gap-3">
        <Avatar className="size-12" size={48} user={user} />
        <div className="flex min-w-0 flex-col">
          <p className="text-foreground truncate font-medium">{user.name}</p>
          <p className="text-muted-foreground truncate text-sm">
            @{user.nameCode}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-foreground text-2xl font-semibold tabular-nums">
          {tCard("points", { count: preview.points.current })}
        </p>
        <p
          className={cn(
            "text-sm leading-relaxed text-pretty",
            suspended
              ? FEEDBACK_TONE_TEXT.destructive
              : "text-muted-foreground",
          )}
        >
          {suspended
            ? suspendedUntil
              ? tCard("suspended_until", {
                  relative: format.relativeTime(new Date(suspendedUntil), now),
                })
              : tCard("suspended_indefinitely")
            : tCard("no_restrictions")}
        </p>
      </div>

      <section aria-labelledby={headingId} className="flex flex-col gap-3">
        <h3
          className="text-muted-foreground text-xs font-medium"
          id={headingId}
        >
          {t("recent")}
        </h3>
        {!preview.permissions.viewWarnings || query.isError ? (
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {t("unavailable")}
          </p>
        ) : query.isPending ? (
          <div aria-busy="true" className="flex flex-col gap-3">
            {[0, 1].map(row => (
              <div className="flex gap-3" key={row}>
                <Skeleton className="size-8 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : recent.length === 0 ? (
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {t("first")}
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {recent.map(warning => (
              <li className="flex gap-3" key={warning.id}>
                <WarningNode size="sm" warning={warning} />
                <div className="flex min-w-0 flex-col">
                  <p
                    className={cn(
                      "line-clamp-2 text-sm font-medium text-pretty",
                      warning.status === "revoked"
                        ? "text-muted-foreground line-through"
                        : "text-foreground",
                    )}
                  >
                    {reasonTextOf(warning, locale, tWarn("custom_reason"))}
                  </p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {tWarn("points", { count: warning.points })} ·{" "}
                    {format.relativeTime(warning.issuedAt, now)}
                  </p>
                </div>
              </li>
            ))}
            {older > 0 ? (
              <li className="text-muted-foreground text-xs">
                {t("older", { count: older })}
              </li>
            ) : null}
          </ol>
        )}
      </section>
    </aside>
  );
};

export const OutcomeSummary = ({
  isFetching,
  preview,
}: {
  isFetching: boolean;
  preview: WarningPreview;
}) => {
  const t = useTranslations("core.moderation.warn");

  return (
    <div
      aria-busy={isFetching}
      aria-label={t("consequences.title")}
      aria-live="polite"
      className={cn(
        "flex min-w-0 flex-col gap-0.5 text-sm leading-snug motion-safe:transition-opacity",
        isFetching ? "opacity-60" : null,
      )}
      role="group"
    >
      <p className="text-foreground flex items-center gap-1.5 font-medium tabular-nums">
        <span className="text-muted-foreground">{preview.points.current}</span>
        <ArrowRightIcon
          aria-hidden="true"
          className="text-muted-foreground size-3.5 rtl:-scale-x-100"
        />
        <span>
          {t.rich("points_animated", {
            count: preview.points.projected,
            n: () => <SlidingNumber value={preview.points.projected} />,
          })}
        </span>
      </p>
      <p
        className={cn(
          "text-pretty",
          preview.sanction
            ? FEEDBACK_TONE_TEXT.destructive
            : "text-muted-foreground",
        )}
      >
        {preview.sanction ? (
          <SanctionSummary sanction={preview.sanction} />
        ) : (
          t("consequences.no_action")
        )}
      </p>
      {preview.suspendedUntil ? (
        <p className="text-muted-foreground text-pretty">
          {t("consequences.already_suspended")}
        </p>
      ) : null}
      {preview.related.length > 0 ? (
        <p className="text-muted-foreground text-pretty">
          {t("consequences.related", { count: preview.related.length })}
        </p>
      ) : null}
    </div>
  );
};

export const Reveal = ({
  children,
  open,
}: {
  children: React.ReactNode;
  open: boolean;
}) => (
  <div
    className={cn(
      "ease-fluid grid transition-[grid-template-rows,opacity,translate] motion-reduce:transition-none",
      open
        ? "translate-y-0 grid-rows-[1fr] opacity-100 duration-200"
        : "-translate-y-1 grid-rows-[0fr] opacity-0 duration-150",
    )}
    data-slot="reveal"
    data-state={open ? "open" : "closed"}
    inert={!open}
  >
    <div className="-m-1 min-h-0 overflow-hidden p-1">
      <div className="pt-5">{children}</div>
    </div>
  </div>
);
