import { cn } from "cn";
import { ChevronDownIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { RichTextContent } from "@/components/rich-text";
import { isRichTextDocument } from "@/content/rich-text/document";

import type { ModcpApprovalDetail } from "../modcp-query";

import { Chip } from "../report-tone";
import { useApprovalLabels } from "./approval-labels";

type Values = Record<string, unknown>;
type Field = ModcpApprovalDetail["fields"][number];

const TEXT_KINDS = new Set(["slug", "text", "textarea"]);
const MAX_COMPACT_LENGTH = 400;

const isEmptyValue = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);

const compactValue = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  if (
    Array.isArray(value) &&
    value.every(item => ["number", "string"].includes(typeof item))
  ) {
    return value.join(", ");
  }
  const json = JSON.stringify(value) ?? "";

  return json.length > MAX_COMPACT_LENGTH
    ? `${json.slice(0, MAX_COMPACT_LENGTH)}…`
    : json;
};

/** Field values are JSON from the API, so their JSON is what "the same" means. */
export const sameValue = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export const ApprovalFieldValue = ({
  kind,
  value,
}: {
  kind: string;
  value: unknown;
}) => {
  const t = useTranslations("core.moderation.modcp.approvals.detail");

  if (isEmptyValue(value)) {
    return <p className="text-muted-foreground text-sm italic">{t("empty")}</p>;
  }

  if (kind === "richText") {
    return isRichTextDocument(value) ? (
      <RichTextContent
        className="text-foreground leading-relaxed text-pretty break-words"
        content={value}
      />
    ) : (
      <p className="text-muted-foreground text-sm italic">{t("empty")}</p>
    );
  }

  if (typeof value === "boolean") {
    return (
      <p className="text-foreground leading-relaxed">
        {value ? t("yes") : t("no")}
      </p>
    );
  }

  return (
    <p
      className={cn(
        "text-foreground leading-relaxed break-words",
        TEXT_KINDS.has(kind) ? "whitespace-pre-wrap" : "font-mono text-sm",
      )}
    >
      {compactValue(value)}
    </p>
  );
};

const FieldLabel = ({
  changed,
  id,
  label,
}: {
  changed?: boolean;
  id: string;
  label: string;
}) => {
  const t = useTranslations("core.moderation.modcp.approvals.detail");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <h3
        className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
        id={id}
      >
        {label}
      </h3>
      {changed ? <Chip tone="warning">{t("changed")}</Chip> : null}
    </div>
  );
};

const Panel = ({
  children,
  highlight,
  label,
}: {
  children: React.ReactNode;
  highlight?: boolean;
  label: string;
}) => (
  <div
    className={cn(
      "flex min-w-0 flex-col gap-2 rounded-lg p-3 ring-1",
      highlight ? "bg-primary/5 ring-primary/25" : "bg-muted/40 ring-border",
    )}
  >
    <span className="text-muted-foreground text-xs font-medium">{label}</span>
    {children}
  </div>
);

interface FieldsProps {
  data: Pick<ModcpApprovalDetail, "contentTypeId" | "fields" | "pluginId">;
}

/** A new record: every proposed value, in the definition's field order. */
export const ProposedFields = ({
  data,
  values,
}: FieldsProps & { values: Values }) => {
  const labels = useApprovalLabels();
  const baseId = React.useId();
  const fields = data.fields.filter(field => field.name in values);

  return (
    <div className="flex flex-col gap-5">
      {fields.map(field => (
        <section
          aria-labelledby={`${baseId}-${field.name}`}
          className="flex flex-col gap-2"
          key={field.name}
        >
          <FieldLabel
            id={`${baseId}-${field.name}`}
            label={labels.field(data, field.name)}
          />
          <ApprovalFieldValue kind={field.kind} value={values[field.name]} />
        </section>
      ))}
    </div>
  );
};

const ComparedField = ({
  current,
  data,
  field,
  proposed,
}: FieldsProps & {
  current: unknown;
  field: Field;
  proposed: unknown;
}) => {
  const t = useTranslations("core.moderation.modcp.approvals.detail");
  const labels = useApprovalLabels();
  const id = React.useId();
  const changed = !sameValue(current, proposed);

  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <FieldLabel
        changed={changed}
        id={id}
        label={labels.field(data, field.name)}
      />
      {changed ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Panel label={t("live")}>
            <ApprovalFieldValue kind={field.kind} value={current} />
          </Panel>
          <Panel highlight label={t("proposed")}>
            <ApprovalFieldValue kind={field.kind} value={proposed} />
          </Panel>
        </div>
      ) : (
        <ApprovalFieldValue kind={field.kind} value={proposed} />
      )}
    </section>
  );
};

/** An edit: changed fields side by side, the untouched ones folded away. */
export const ComparedFields = ({
  current,
  data,
  values,
}: FieldsProps & { current: Values; values: Values }) => {
  const t = useTranslations("core.moderation.modcp.approvals.detail");
  const fields = data.fields.filter(
    field => field.name in values || field.name in current,
  );
  const proposedOf = (field: Field) =>
    field.name in values ? values[field.name] : current[field.name];
  const changed = fields.filter(
    field => !sameValue(current[field.name], proposedOf(field)),
  );
  const unchanged = fields.filter(field => !changed.includes(field));

  return (
    <div className="flex flex-col gap-5">
      {changed.length === 0 ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("no_changes")}
        </p>
      ) : (
        changed.map(field => (
          <ComparedField
            current={current[field.name]}
            data={data}
            field={field}
            key={field.name}
            proposed={proposedOf(field)}
          />
        ))
      )}

      {unchanged.length > 0 ? (
        <details className="group ring-border flex flex-col rounded-lg ring-1">
          <summary className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium outline-none focus-visible:ring-3">
            {t("unchanged", { count: unchanged.length })}
            <ChevronDownIcon
              aria-hidden
              className="size-4 shrink-0 transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="flex flex-col gap-5 border-t p-3">
            {unchanged.map(field => (
              <ComparedField
                current={current[field.name]}
                data={data}
                field={field}
                key={field.name}
                proposed={proposedOf(field)}
              />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
};

/** True when the live record moved on after the author started editing. */
export const isStaleEdit = (
  data: Pick<ModcpApprovalDetail, "baseValues" | "current" | "values">,
): boolean => {
  if (!data.baseValues || !data.current) return false;
  const { baseValues, current } = data;

  return Object.keys(data.values).some(
    name => !sameValue(baseValues[name], current[name]),
  );
};
