import { useSelector } from "@tanstack/react-form";
import {
  isRichTextDocument,
  isRichTextEmpty,
} from "@vitnode/api/content/rich-text/document";
import { cn } from "cn";
import {
  CircleCheckIcon,
  EyeIcon,
  PowerIcon,
  PowerOffIcon,
  SaveIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { DateFormat } from "@/components/date-format";
import { AutoForm } from "@/components/form/auto-form";
import { AutoFormDateTime } from "@/components/form/fields/date-time";
import { AutoFormEditor } from "@/components/form/fields/editor";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { useLogo } from "@/components/logo-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useFormApi } from "@/components/ui/form";
import { SiteOfflineContent } from "@/views/site-offline/site-offline-content";
import { getVitNodeConfig } from "@/vitnode.config";

import type {
  AdminSiteStatus,
  AdminSiteStatusInput,
} from "./site-status-query";

const documentSchema = z.looseObject({
  content: z.array(z.unknown()).optional(),
  type: z.literal("doc"),
});

/** Whether an ISO time has passed. Runs on validation, never during render. */
const isPast = (iso: string): boolean => Date.parse(iso) <= Date.now();

interface FormValues {
  message: { languageCode: string; value: unknown }[];
  offline: boolean;
  opensAt: null | string;
  showCountdown: boolean;
}

const filledMessage = (message: FormValues["message"]) =>
  message.flatMap(item =>
    isRichTextDocument(item.value) && !isRichTextEmpty(item.value)
      ? [{ languageCode: item.languageCode, value: item.value }]
      : [],
  );

const useFormValues = (): FormValues => {
  const { form } = useFormApi();

  // `useFormApi` is untyped; the values follow this screen's `formSchema`.
  return useSelector(form.store, state => state.values as FormValues);
};

const StatusHeader = ({ data }: { data: AdminSiteStatus }) => {
  const t = useTranslations("admin.system.site_status");
  const { offline } = useFormValues();

  return (
    <div className="flex items-start gap-4">
      <span
        aria-hidden="true"
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          offline ? "bg-warn/10 text-warn" : "bg-success/10 text-success",
        )}
      >
        {offline ? (
          <PowerOffIcon className="size-5" />
        ) : (
          <CircleCheckIcon className="size-5" />
        )}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg text-balance">
            {offline ? t("status.offline") : t("status.online")}
          </CardTitle>
          <Badge variant={offline ? "warning" : "success"}>
            {offline ? t("badge.offline") : t("badge.online")}
          </Badge>
          {offline === data.offline ? null : (
            <Badge variant="outline">{t("status.not_saved")}</Badge>
          )}
        </div>
        <CardDescription className="leading-relaxed text-pretty">
          {data.changedAt ? (
            <>
              {t("status.last_switched")} <DateFormat date={data.changedAt} />
              {data.changedBy
                ? ` · ${t("status.by", { name: data.changedBy.name })}`
                : null}
            </>
          ) : (
            t("status.never")
          )}
        </CardDescription>
      </div>
    </div>
  );
};

const LivePreview = ({ fetchedAt }: { fetchedAt: number }) => {
  const t = useTranslations("admin.system.site_status.preview");
  const values = useFormValues();
  const locale = useLocale();
  const logo = useLogo();

  return (
    <section
      aria-labelledby="site-status-preview"
      className="flex flex-col gap-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          className="inline-flex items-center gap-2 text-sm font-medium"
          id="site-status-preview"
        >
          <EyeIcon aria-hidden="true" className="size-4" />
          {t("title")}
        </h2>
        <p className="text-muted-foreground text-xs">
          {values.offline ? t("now") : t("offline_only")}
        </p>
      </div>
      <div
        className={cn(
          "bg-muted/40 flex justify-center rounded-xl border px-4 py-8 transition-opacity duration-150 ease-out motion-reduce:transition-none",
          !values.offline && "opacity-60",
        )}
      >
        <SiteOfflineContent
          fetchedAt={fetchedAt}
          headingLevel={2}
          language={locale}
          logo={logo}
          status={{
            message: filledMessage(values.message),
            opensAt: values.opensAt,
            serverNow: new Date(fetchedAt).toISOString(),
            showCountdown: values.showCountdown,
          }}
        />
      </div>
    </section>
  );
};

const SaveBar = ({ data }: { data: AdminSiteStatus }) => {
  const t = useTranslations("admin.system.site_status.save_bar");
  const { form } = useFormApi();
  const isDirty = useSelector(form.store, state => !state.isDefaultValue);
  const isSubmitting = useSelector(form.store, state => state.isSubmitting);
  const { offline } = useFormValues();
  if (!isDirty) return null;

  const switching = offline !== data.offline;
  let label = t("save");
  let icon = <SaveIcon aria-hidden="true" />;
  if (switching && offline) {
    label = t("turn_off");
    icon = <PowerOffIcon aria-hidden="true" />;
  } else if (switching) {
    label = t("turn_on");
    icon = <PowerIcon aria-hidden="true" />;
  }

  return (
    <div className="bg-popover/95 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border p-3 shadow-lg backdrop-blur-sm motion-safe:duration-200">
      <p className="text-muted-foreground px-1 text-sm">{t("unsaved")}</p>
      <div className="flex items-center gap-2">
        <Button
          disabled={isSubmitting}
          onClick={() => form.reset()}
          type="button"
          variant="ghost"
        >
          {t("discard")}
        </Button>
        <Button
          isLoading={isSubmitting}
          type="submit"
          variant={switching && offline ? "destructive" : "default"}
        >
          {icon}
          {label}
        </Button>
      </div>
    </div>
  );
};

/**
 * The AdminCP site status screen: the switch, the per-language message and
 * the opening time edited in place, beside a live preview of the offline
 * page. A save bar appears with unsaved changes and names what saving does.
 */
export const SiteStatusContent = ({
  canManage,
  data,
  fetchedAt,
  onSave,
}: {
  canManage: boolean;
  data: AdminSiteStatus;
  /** When `data` arrived (`dataUpdatedAt`): the preview's countdown runs from it, the same on the server and in the browser. */
  fetchedAt: number;
  onSave: (values: AdminSiteStatusInput) => Promise<AdminMutationResult<true>>;
}) => {
  const t = useTranslations("admin.system.site_status");
  const tError = useTranslations("core.global.errors");
  const defaultLanguage = getVitNodeConfig().i18n.defaultLocale;

  const formSchema = z
    .object({
      offline: z.boolean().default(data.offline),
      message: z
        .array(z.object({ languageCode: z.string(), value: documentSchema }))
        .default(
          data.message.map(item => ({
            languageCode: item.languageCode,
            value: { ...item.value },
          })),
        ),
      opensAt: z.string().nullable().default(data.opensAt),
      showCountdown: z.boolean().default(data.showCountdown),
    })
    .superRefine((values, ctx) => {
      if (
        values.offline &&
        !filledMessage(values.message).some(
          item => item.languageCode === defaultLanguage,
        )
      ) {
        ctx.addIssue({
          code: "custom",
          message: t("form.message.required"),
          path: ["message"],
        });
      }
      if (
        values.opensAt !== null &&
        values.opensAt !== data.opensAt &&
        isPast(values.opensAt)
      ) {
        ctx.addIssue({
          code: "custom",
          message: t("form.opens_at.past"),
          path: ["opensAt"],
        });
      }
    });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    values,
    formApi,
  ) => {
    const result = await onSave({
      message: filledMessage(values.message),
      offline: values.offline,
      opensAt: values.opensAt,
      showCountdown: values.showCountdown,
    });
    if ("error" in result) {
      toast.error(tError("title"), {
        description:
          result.error.status === 400 && result.error.message
            ? result.error.message
            : tError("internal_server_error"),
      });

      return;
    }

    formApi.reset(formApi.state.values);
    let key: "saved" | "turned_off" | "turned_on" = "saved";
    if (values.offline !== data.offline) {
      key = values.offline ? "turned_off" : "turned_on";
    }
    toast.success(t(`toast.${key}.title`), {
      description: t(`toast.${key}.desc`),
    });
  };

  return (
    <AutoForm
      className="flex flex-col gap-0"
      fields={[
        {
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("form.offline.desc")}
              disabled={!canManage}
              label={t("form.offline.label")}
            />
          ),
          id: "offline",
        },
        {
          component: props => (
            <AutoFormEditor
              {...props}
              className="min-h-40"
              description={t("form.message.desc")}
              format="json"
              label={t("form.message.label")}
              multiLang
              placeholder={t("form.message.placeholder")}
            />
          ),
          id: "message",
        },
        {
          component: props => (
            <AutoFormDateTime
              {...props}
              description={t("form.opens_at.desc")}
              disabled={!canManage}
              label={t("form.opens_at.label")}
            />
          ),
          id: "opensAt",
        },
        {
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("form.show_countdown.desc")}
              disabled={!canManage}
              label={t("form.show_countdown.label")}
            />
          ),
          hidden: values => !values.opensAt,
          id: "showCountdown",
        },
      ]}
      formSchema={formSchema}
      layout={rendered => (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <StatusHeader data={data} />
              </CardHeader>
              <CardContent>{rendered.offline}</CardContent>
            </Card>
            <Card>
              <CardContent>{rendered.message}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("form.opening.title")}
                </CardTitle>
                <CardDescription className="leading-relaxed text-pretty">
                  {t("form.opening.desc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {rendered.opensAt}
                {rendered.showCountdown}
              </CardContent>
            </Card>
            {canManage ? <SaveBar data={data} /> : null}
          </div>
          <div className="lg:sticky lg:top-6">
            <LivePreview fetchedAt={fetchedAt} />
          </div>
        </div>
      )}
      onSubmit={onSubmit}
    />
  );
};
