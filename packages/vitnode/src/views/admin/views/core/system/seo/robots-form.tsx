import { useSelector } from "@tanstack/react-form";
import { buildRobotsTxt } from "@vitnode/api/lib/seo/robots";
import { SEO_SETTINGS_LIMITS } from "@vitnode/api/lib/seo/settings";
import { ExternalLinkIcon, SaveIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { AutoForm, AutoFormSubmitButton } from "@/components/form/auto-form";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { AutoFormTextarea } from "@/components/form/fields/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CopyButton } from "@/components/ui/copy-button";
import { useFormApi } from "@/components/ui/form";

import type { SeoAdminSettings } from "./seo-query";

import { seoSaveErrorDescription } from "./save-error";

interface RobotsPreviewValues {
  allowIndexing?: boolean;
  blockAiCrawlers?: boolean;
  customRobots?: string;
}

const RobotsPreview = ({ data }: { data: SeoAdminSettings }) => {
  const t = useTranslations("admin.system.seo.robots.preview");
  const { form } = useFormApi();
  const values = useSelector(
    form.store,
    state => state.values as RobotsPreviewValues,
  );
  const sitemapOn = data.settings.sitemap.enabled;
  const content = buildRobotsTxt({
    allowIndexing: values.allowIndexing ?? data.settings.allowIndexing,
    blockAiCrawlers: values.blockAiCrawlers ?? data.settings.blockAiCrawlers,
    customRobots: values.customRobots ?? data.settings.customRobots,
    disallow: data.robots.disallow,
    offline: data.robots.offline,
    sitemapUrl: sitemapOn ? data.robots.sitemapUrl : null,
  });
  const robotsUrl = new URL("/robots.txt", data.siteOrigin).href;

  return (
    <section
      aria-labelledby="seo-robots-preview"
      className="flex flex-col gap-3 rounded-lg border p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h3
            className="text-base font-semibold text-balance"
            id="seo-robots-preview"
          >
            {t("title")}
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {data.robots.offline ? t("offline") : t("desc")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CopyButton aria-label={t("copy")} content={content} />
          <a
            className="text-primary inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
            href={robotsUrl}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLinkIcon aria-hidden="true" className="size-4" />
            {t("open")}
          </a>
        </div>
      </div>
      <pre
        aria-live="polite"
        className="bg-muted text-foreground max-h-96 overflow-auto rounded-md p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap"
      >
        {content}
      </pre>
    </section>
  );
};

const IndexingOffWarning = () => {
  const t = useTranslations("admin.system.seo.robots.indexing_off");
  const { form } = useFormApi();
  const allowIndexing = useSelector(
    form.store,
    state => (state.values as RobotsPreviewValues).allowIndexing,
  );
  if (allowIndexing !== false) return null;

  return (
    <Alert icon={<TriangleAlertIcon aria-hidden="true" />} variant="warning">
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription>{t("desc")}</AlertDescription>
    </Alert>
  );
};

export interface RobotsFormProps {
  canManage: boolean;
  data: SeoAdminSettings;
  onSave: (
    values: Pick<
      SeoAdminSettings["settings"],
      "allowIndexing" | "blockAiCrawlers" | "customRobots"
    >,
  ) => Promise<AdminMutationResult<SeoAdminSettings>>;
}

/** General crawling settings and the custom `robots.txt` rules, with a live preview. */
export const RobotsForm = ({ canManage, data, onSave }: RobotsFormProps) => {
  const t = useTranslations("admin.system.seo");
  const tError = useTranslations("core.global.errors");
  const { settings } = data;

  const formSchema = z.object({
    allowIndexing: z.boolean().default(settings.allowIndexing),
    blockAiCrawlers: z.boolean().default(settings.blockAiCrawlers),
    customRobots: z
      .string()
      .max(SEO_SETTINGS_LIMITS.customRobotsMaxLength)
      .default(settings.customRobots),
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
              description={t("robots.allow_indexing.desc")}
              disabled={!canManage}
              label={t("robots.allow_indexing.label")}
            />
          ),
          id: "allowIndexing",
        },
        {
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("robots.block_ai.desc")}
              disabled={!canManage}
              label={t("robots.block_ai.label")}
            />
          ),
          id: "blockAiCrawlers",
        },
        {
          component: props => (
            <AutoFormTextarea
              {...props}
              className="font-mono"
              description={t("robots.custom.desc")}
              disabled={!canManage}
              label={t("robots.custom.label")}
              placeholder={"User-agent: Bingbot\nCrawl-delay: 5"}
              rows={6}
              spellCheck={false}
            />
          ),
          id: "customRobots",
        },
      ]}
      formSchema={formSchema}
      layout={rendered => (
        <>
          <div className="flex flex-col gap-6">
            {rendered.allowIndexing}
            <IndexingOffWarning />
            {rendered.blockAiCrawlers}
            {rendered.customRobots}
          </div>
          <RobotsPreview data={data} />
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
