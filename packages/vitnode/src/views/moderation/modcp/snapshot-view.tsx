import { CameraIcon, FileIcon, ScissorsIcon } from "lucide-react";
import { useFormatter, useTranslations } from "use-intl";

import type {
  ModerationReportSnapshot,
  ModerationSnapshotField,
} from "@/lib/moderation/snapshot";

import { RichTextContent } from "@/components/rich-text";
import { Badge } from "@/components/ui/badge";
import { isRichTextDocument } from "@/content/rich-text/document";
import { formatBytes } from "@/lib/format-bytes";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSnapshot = (value: unknown): value is ModerationReportSnapshot =>
  isRecord(value) && Array.isArray(value.fields);

export const readSnapshot = (value: unknown) =>
  isSnapshot(value) ? value : null;

const FieldValue = ({ field }: { field: ModerationSnapshotField }) => {
  const t = useTranslations("core.moderation.modcp.detail.snapshot");

  switch (field.kind) {
    case "file":
      return field.value.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {field.value.map(file => (
            <li
              className="bg-muted/50 flex items-start gap-2 rounded-md p-2 text-sm"
              key={`${String(file.id)}-${file.name ?? ""}-${file.url ?? ""}`}
            >
              <FileIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-medium">
                  {file.name ?? t("file_missing")}
                </span>
                <span className="text-muted-foreground text-xs">
                  {[file.mimeType, file.size ? formatBytes(file.size) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="text-muted-foreground text-xs">
                  {t("file")}
                </span>
              </span>
            </li>
          ))}
        </ul>
      );
    case "richText":
      return isRichTextDocument(field.value) ? (
        <RichTextContent
          className="text-foreground leading-relaxed text-pretty"
          content={field.value}
        />
      ) : (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      );
    case "text":
      return field.value ? (
        <p className="text-foreground leading-relaxed break-words whitespace-pre-wrap">
          {field.value}
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      );
    default:
      return (
        <p className="text-foreground leading-relaxed">
          {field.value === null || field.value === ""
            ? t("empty")
            : String(field.value)}
        </p>
      );
  }
};

export const SnapshotView = ({
  snapshot,
}: {
  snapshot: ModerationReportSnapshot;
}) => {
  const t = useTranslations("core.moderation.modcp.detail.snapshot");
  const tRoot = useTranslations();
  const format = useFormatter();

  const labelOf = (field: ModerationSnapshotField) =>
    field.label && tRoot.has(field.label as never)
      ? tRoot(field.label as never)
      : field.name;

  return (
    <section
      aria-labelledby="report-snapshot-title"
      className="bg-card flex flex-col gap-4 rounded-xl border p-4 md:p-6"
    >
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            <CameraIcon aria-hidden />
            {t("badge")}
          </Badge>
          <h2
            className="text-foreground text-lg font-semibold text-balance"
            id="report-snapshot-title"
          >
            {t("title")}
          </h2>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t("desc", {
            date: format.dateTime(new Date(snapshot.capturedAt), {
              dateStyle: "medium",
              timeStyle: "short",
            }),
          })}
        </p>
        <p className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {snapshot.locale?.served ? (
            <span>
              {snapshot.locale.fallback && snapshot.locale.requested
                ? t("fallback", {
                    requested: snapshot.locale.requested,
                    served: snapshot.locale.served,
                  })
                : t("locale", { served: snapshot.locale.served })}
            </span>
          ) : null}
          {snapshot.source?.version ? (
            <span>{t("version", { version: snapshot.source.version })}</span>
          ) : null}
          {snapshot.authors?.length ? (
            <span>
              {t("by", {
                names: snapshot.authors.map(author => author.name).join(", "),
              })}
            </span>
          ) : null}
        </p>
        {snapshot.truncated ? (
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <ScissorsIcon aria-hidden className="size-3.5" />
            {t("truncated")}
          </p>
        ) : null}
      </header>

      {snapshot.title ? (
        <p className="text-foreground text-xl font-semibold text-balance">
          {snapshot.title}
        </p>
      ) : null}

      <dl className="flex flex-col gap-4">
        {snapshot.fields.map(field => (
          <div className="flex flex-col gap-1.5" key={field.name}>
            <dt className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {labelOf(field)}
            </dt>
            <dd>
              <FieldValue field={field} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
};
