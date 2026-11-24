import type { SiteStatusUpdate } from "@vitnode/api/lib/site-status";

import { useSelector } from "@tanstack/react-form";
import {
  isRichTextDocument,
  isRichTextEmpty,
} from "@vitnode/api/content/rich-text/document";
import { cn } from "cn";
import {
  CircleCheckIcon,
  PowerIcon,
  PowerOffIcon,
  SaveIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";
import type { AdminSiteStatus } from "@/views/admin/views/core/system/site-status/site-status-query";

import { DateFormat } from "@/components/date-format";
import { AutoForm } from "@/components/form/auto-form";
import { AutoFormDateTime } from "@/components/form/fields/date-time";
import { AutoFormEditor } from "@/components/form/fields/editor";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFormApi } from "@/components/ui/form";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/ui/frame";
import { ValueSwap } from "@/components/ui/value-swap";
import { getVitNodeConfig } from "@/vitnode.config";

const SITE_STATUS_ANCHOR = "site-status";

const documentSchema = z.looseObject({
  content: z.array(z.unknown()).optional(),
  type: z.literal("doc"),
});

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

  return useSelector(form.store, state => state.values as FormValues);
};

const useIsFormDirty = (): boolean => {
  const { form } = useFormApi();

  return useSelector(form.store, state => !state.isDefaultValue);
};

const Reveal = ({
  children,
  from,
  open,
}: {
  children: React.ReactNode;
  from: "above" | "below";
  open: boolean;
}) => (
  <div
    className={cn(
      "grid transition-[grid-template-rows,opacity,translate] will-change-transform motion-reduce:transition-none",
      open
        ? "translate-y-0 grid-rows-[1fr] opacity-100 duration-250 ease-[cubic-bezier(0.32,0.72,0,1)]"
        : "grid-rows-[0fr] opacity-0 duration-180 ease-[cubic-bezier(0.4,0,1,1)]",
      !open && (from === "above" ? "-translate-y-1" : "translate-y-1"),
    )}
    inert={!open}
  >
    <div className="-mx-1 min-h-0 overflow-hidden px-1">{children}</div>
  </div>
);

const StatusIcon = ({ offline }: { offline: boolean }) => {
  const icon =
    "absolute inset-0 m-auto size-5 transition-[opacity,scale,filter] motion-reduce:transition-none";
  const shown = "blur-none scale-100 opacity-100 duration-200 ease-out";
  const hidden = "blur-xs scale-75 opacity-0 duration-150 ease-in";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative row-span-2 size-10 shrink-0 rounded-lg transition-colors duration-200 ease-out motion-reduce:transition-none",
        offline ? "bg-warn/10 text-warn" : "bg-success/10 text-success",
      )}
    >
      <CircleCheckIcon className={cn(icon, offline ? hidden : shown)} />
      <PowerOffIcon className={cn(icon, offline ? shown : hidden)} />
    </span>
  );
};

const StatusHeader = ({ data }: { data: AdminSiteStatus }) => {
  const t = useTranslations("admin.system.site_status");
  const { offline } = useFormValues();

  return (
    <FrameHeader className="grid-cols-[auto_1fr] gap-y-0.5">
      <StatusIcon offline={offline} />
      <FrameTitle className="col-start-2 flex min-w-0 flex-wrap items-center gap-2">
        <ValueSwap swapKey={String(offline)}>
          {offline ? t("status.offline") : t("status.online")}
        </ValueSwap>
        {offline === data.offline ? null : (
          <Badge
            className="motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-150"
            variant="outline"
          >
            {t("status.not_saved")}
          </Badge>
        )}
      </FrameTitle>
      <FrameDescription className="col-start-2">
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
      </FrameDescription>
    </FrameHeader>
  );
};

const SubmitButton = ({ data }: { data: AdminSiteStatus }) => {
  const t = useTranslations("admin.system.site_status.save_bar");
  const { form } = useFormApi();
  const isSubmitting = useSelector(form.store, state => state.isSubmitting);
  const { offline } = useFormValues();
  const switching = offline !== data.offline;

  let action: "save" | "turn_off" | "turn_on" = "save";
  if (switching) action = offline ? "turn_off" : "turn_on";
  const Icon = {
    save: SaveIcon,
    turn_off: PowerOffIcon,
    turn_on: PowerIcon,
  }[action];

  return (
    <Button
      isLoading={isSubmitting}
      type="submit"
      variant={action === "turn_off" ? "destructive" : "default"}
    >
      <Icon aria-hidden="true" />
      <ValueSwap swapKey={action}>{t(action)}</ValueSwap>
    </Button>
  );
};

const SaveFooter = ({ data }: { data: AdminSiteStatus }) => {
  const t = useTranslations("admin.system.site_status.save_bar");
  const { form } = useFormApi();
  const isDirty = useIsFormDirty();
  const isSubmitting = useSelector(form.store, state => state.isSubmitting);

  return (
    <Reveal from="above" open={isDirty}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 pt-3 pb-2">
        <p aria-live="polite" className="text-muted-foreground text-sm">
          {isDirty ? t("unsaved") : null}
        </p>
        <div className="flex items-center gap-2">
          <Button
            disabled={isSubmitting}
            onClick={() => form.reset()}
            type="button"
            variant="ghost"
          >
            {t("discard")}
          </Button>
          <SubmitButton data={data} />
        </div>
      </div>
    </Reveal>
  );
};

const OfflineDetails = ({ children }: { children: React.ReactNode }) => {
  const { offline } = useFormValues();

  return (
    <Reveal from="above" open={offline}>
      <div className="flex flex-col gap-6 pt-6">{children}</div>
    </Reveal>
  );
};

export const SiteStatusFrame = ({
  canManage,
  data,
  onSave,
}: {
  canManage: boolean;
  data: AdminSiteStatus;
  onSave: (values: SiteStatusUpdate) => Promise<AdminMutationResult<true>>;
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
              className="min-h-32"
              format="json"
              label={t("form.message.label")}
              multiLang
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
        <Frame
          aria-label={t("title")}
          className="scroll-mt-4"
          id={SITE_STATUS_ANCHOR}
          render={<section />}
        >
          <StatusHeader data={data} />
          <FramePanel>
            <div className="flex flex-col p-4">
              {rendered.offline}
              <OfflineDetails>
                {rendered.message}
                <div className="grid items-start gap-4 sm:grid-cols-2">
                  {rendered.opensAt}
                  {rendered.showCountdown}
                </div>
              </OfflineDetails>
            </div>
          </FramePanel>
          {canManage ? <SaveFooter data={data} /> : null}
        </Frame>
      )}
      onSubmit={onSubmit}
    />
  );
};
