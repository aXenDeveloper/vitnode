import { useSelector } from "@tanstack/react-form";
import { SEO_SETTINGS_LIMITS } from "@vitnode/api/lib/seo/settings";
import { ExternalLinkIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { AutoForm, AutoFormSubmitButton } from "@/components/form/auto-form";
import { AutoFormNumber } from "@/components/form/fields/number";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useFormApi } from "@/components/ui/form";

import type { SeoAdminSettings } from "./seo-query";

import { seoSaveErrorDescription } from "./save-error";

const SitemapLink = ({ data }: { data: SeoAdminSettings }) => {
  const t = useTranslations("admin.system.seo.sitemaps");
  const { form } = useFormApi();
  const enabled = useSelector(
    form.store,
    state => (state.values as { enabled?: boolean }).enabled,
  );
  if (!data.settings.allowIndexing) {
    return (
      <Alert variant="info">
        <AlertDescription>{t("indexing_off")}</AlertDescription>
      </Alert>
    );
  }
  if (!enabled || !data.settings.sitemap.enabled) return null;

  return (
    <a
      className="text-primary inline-flex items-center gap-1 self-start text-sm underline-offset-4 hover:underline"
      href={data.robots.sitemapUrl}
      rel="noreferrer"
      target="_blank"
    >
      <ExternalLinkIcon aria-hidden="true" className="size-4" />
      {t("open", { url: data.robots.sitemapUrl })}
    </a>
  );
};

export interface SitemapsFormProps {
  canManage: boolean;
  data: SeoAdminSettings;
  onSave: (values: {
    enabled: boolean;
    maxUrlsPerFile: number;
  }) => Promise<AdminMutationResult<SeoAdminSettings>>;
}

/** Whether sitemaps are served, and how many URLs go in one file. */
export const SitemapsForm = ({
  canManage,
  data,
  onSave,
}: SitemapsFormProps) => {
  const t = useTranslations("admin.system.seo");
  const tError = useTranslations("core.global.errors");
  const { sitemap } = data.settings;

  const formSchema = z.object({
    enabled: z.boolean().default(sitemap.enabled),
    maxUrlsPerFile: z
      .number()
      .int()
      .min(SEO_SETTINGS_LIMITS.sitemapMaxUrlsMin)
      .max(SEO_SETTINGS_LIMITS.sitemapMaxUrlsMax)
      .default(sitemap.maxUrlsPerFile),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    values,
    formApi,
  ) => {
    const result = await onSave(values);
    if ("error" in result) {
      toast.error(tError("title"), {
        description: seoSaveErrorDescription(result.error, tError),
      });

      return;
    }

    formApi.reset(formApi.state.values);
    toast.success(t("saved.title"), { description: t("saved.desc") });
  };

  return (
    <AutoForm
      className="flex flex-col gap-6"
      fields={[
        {
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("sitemaps.enabled.desc")}
              disabled={!canManage}
              label={t("sitemaps.enabled.label")}
            />
          ),
          id: "enabled",
        },
        {
          component: props => (
            <AutoFormNumber
              {...props}
              description={t("sitemaps.max_urls.desc", {
                max: SEO_SETTINGS_LIMITS.sitemapMaxUrlsMax,
              })}
              disabled={!canManage}
              label={t("sitemaps.max_urls.label")}
              max={SEO_SETTINGS_LIMITS.sitemapMaxUrlsMax}
              min={SEO_SETTINGS_LIMITS.sitemapMaxUrlsMin}
              step={1000}
              unitLabel={t("sitemaps.max_urls.unit")}
            />
          ),
          hidden: values => values.enabled === false,
          id: "maxUrlsPerFile",
        },
      ]}
      formSchema={formSchema}
      layout={rendered => (
        <>
          <div className="flex flex-col gap-6">
            {rendered.enabled}
            <SitemapLink data={data} />
            {rendered.maxUrlsPerFile}
          </div>
          {canManage && (
            <div className="flex justify-end">
              <AutoFormSubmitButton>
                <SaveIcon aria-hidden="true" />
                {t("submit")}
              </AutoFormSubmitButton>
            </div>
          )}
        </>
      )}
      onSubmit={onSubmit}
    />
  );
};
