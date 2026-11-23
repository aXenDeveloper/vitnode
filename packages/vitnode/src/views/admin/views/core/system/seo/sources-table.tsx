import type { ContentLabelTranslator } from "@vitnode/api/content/admin/labels";

import { contentNouns } from "@vitnode/api/content/admin/labels";
import { ExternalLinkIcon, FileWarningIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useFormatter, useTranslations } from "use-intl";

import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { SeoAdminSettings } from "./seo-query";

import { seoSaveErrorDescription } from "./save-error";

type SeoSource = SeoAdminSettings["sources"][number];

type LabelTranslator = ContentLabelTranslator;

/** A source's name: the content type's noun, the translated key, or the text as given. */
export const seoSourceLabel = (source: SeoSource, t: LabelTranslator) =>
  source.contentType
    ? contentNouns(
        { id: source.contentType.id },
        source.contentType.pluginId,
        t,
      ).title
    : t.has(source.label)
      ? t(source.label)
      : source.label;

const SourceSwitch = ({
  canManage,
  label,
  onToggle,
  source,
}: {
  canManage: boolean;
  label: string;
  onToggle: (
    source: SeoSource,
    enabled: boolean,
  ) => Promise<AdminMutationResult<SeoAdminSettings>>;
  source: SeoSource;
}) => {
  const t = useTranslations("admin.system.seo.sources");
  const tError = useTranslations("core.global.errors");
  const [pending, setPending] = React.useState<boolean | null>(null);

  const onCheckedChange = async (enabled: boolean) => {
    setPending(enabled);
    try {
      const result = await onToggle(source, enabled);
      if ("error" in result) {
        toast.error(tError("title"), {
          description: seoSaveErrorDescription(result.error, tError),
        });

        return;
      }
      toast.success(t(enabled ? "toggled.on" : "toggled.off", { label }), {
        description: t(enabled ? "toggled.on_desc" : "toggled.off_desc"),
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <Switch
      aria-busy={pending !== null}
      aria-label={t("toggle_label", { label })}
      checked={pending ?? source.enabled}
      disabled={!canManage || pending !== null}
      onCheckedChange={enabled => void onCheckedChange(enabled)}
    />
  );
};

export interface SourcesTableProps {
  canManage: boolean;
  data: SeoAdminSettings;
  onToggle: (
    source: SeoSource,
    enabled: boolean,
  ) => Promise<AdminMutationResult<SeoAdminSettings>>;
}

/** Every registered sitemap source with its size, a switch and a preview link. */
export const SourcesTable = ({
  canManage,
  data,
  onToggle,
}: SourcesTableProps) => {
  const t = useTranslations("admin.system.seo.sources");
  const tAll = useTranslations() as unknown as LabelTranslator;
  const format = useFormatter();
  const served = data.settings.allowIndexing && data.settings.sitemap.enabled;

  return (
    <section aria-labelledby="seo-sources" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-balance" id="seo-sources">
          {t("title")}
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t("desc")}
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.source")}</TableHead>
              <TableHead className="text-end">{t("columns.urls")}</TableHead>
              <TableHead className="text-end">{t("columns.files")}</TableHead>
              <TableHead>{t("columns.preview")}</TableHead>
              <TableHead className="text-end">{t("columns.enabled")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.sources.map(source => {
              const label = seoSourceLabel(source, tAll);
              const previewUrl = new URL(
                `/sitemaps/${source.id}-1.xml`,
                data.siteOrigin,
              ).href;

              return (
                <TableRow key={source.id}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{label}</span>
                      <code className="text-muted-foreground text-xs">
                        {source.id}
                      </code>
                    </div>
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {source.error ? (
                      <Badge variant="destructive">
                        <FileWarningIcon aria-hidden="true" />
                        {t("error")}
                      </Badge>
                    ) : (
                      format.number(source.urls)
                    )}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {format.number(source.files)}
                  </TableCell>
                  <TableCell>
                    {served && source.enabled && source.urls > 0 ? (
                      <a
                        className="text-primary inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
                        href={previewUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <ExternalLinkIcon
                          aria-hidden="true"
                          className="size-4"
                        />
                        {t("preview")}
                        <span className="sr-only">{label}</span>
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        {source.urls === 0 ? t("empty") : t("not_served")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    <SourceSwitch
                      canManage={canManage}
                      label={label}
                      onToggle={onToggle}
                      source={source}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
};
