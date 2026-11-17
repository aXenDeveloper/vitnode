// PROTOTYPE site-status-admin: throwaway variant, delete after the decision.

import { useSelector } from "@tanstack/react-form";
import { isRichTextDocument } from "@vitnode/api/content/rich-text/document";
import { cn } from "cn";
import {
  CircleCheckIcon,
  EyeIcon,
  PowerIcon,
  PowerOffIcon,
  SaveIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "use-intl";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

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

import type { ProtoProps } from "./shared";

import { statusFormSchema, toPayload } from "./shared";

interface FormValues {
  message: { languageCode: string; value: unknown }[];
  offline: boolean;
  opensAt: null | string;
  showCountdown: boolean;
}

const useValues = (): FormValues => {
  const { form } = useFormApi();

  return useSelector(form.store, state => state.values as FormValues);
};

const StatusHeader = ({ data }: Pick<ProtoProps, "data">) => {
  const { offline } = useValues();
  const changed = offline !== data.offline;

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
            {offline ? "Site is offline" : "Site is online"}
          </CardTitle>
          <Badge variant={offline ? "warning" : "success"}>
            {offline ? "Offline" : "Online"}
          </Badge>
          {changed ? <Badge variant="outline">Not saved yet</Badge> : null}
        </div>
        <CardDescription className="leading-relaxed text-pretty">
          {data.changedAt ? (
            <>
              Last switched <DateFormat date={data.changedAt} />
              {data.changedBy ? ` by ${data.changedBy.name}` : null}
            </>
          ) : (
            "Never switched off"
          )}
        </CardDescription>
      </div>
    </div>
  );
};

const LivePreview = ({ fetchedAt }: Pick<ProtoProps, "fetchedAt">) => {
  const values = useValues();
  const locale = useLocale();
  const logo = useLogo();
  const message = values.message.flatMap(item =>
    isRichTextDocument(item.value)
      ? [{ languageCode: item.languageCode, value: item.value }]
      : [],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-sm font-medium">
          <EyeIcon aria-hidden="true" className="size-4" />
          Live preview
        </p>
        <p className="text-muted-foreground text-xs">
          {values.offline ? "What visitors see now" : "Shown while offline"}
        </p>
      </div>
      <div
        className={cn(
          "bg-muted/40 flex justify-center rounded-xl border px-4 py-8 transition-opacity duration-150 ease-out",
          !values.offline && "opacity-60",
        )}
      >
        <SiteOfflineContent
          fetchedAt={fetchedAt}
          headingLevel={2}
          language={locale}
          logo={logo}
          status={{
            message,
            opensAt: values.opensAt,
            serverNow: new Date(fetchedAt).toISOString(),
            showCountdown: values.showCountdown,
          }}
        />
      </div>
    </div>
  );
};

const SaveBar = ({ data }: Pick<ProtoProps, "data">) => {
  const { form } = useFormApi();
  const isDirty = useSelector(form.store, state => !state.isDefaultValue);
  const isSubmitting = useSelector(form.store, state => state.isSubmitting);
  const { offline } = useValues();
  const switching = offline !== data.offline;

  let label = "Save changes";
  let icon = <SaveIcon aria-hidden="true" />;
  if (switching && offline) {
    label = "Turn off site";
    icon = <PowerOffIcon aria-hidden="true" />;
  } else if (switching) {
    label = "Turn on site";
    icon = <PowerIcon aria-hidden="true" />;
  }

  if (!isDirty) return null;

  return (
    <div className="bg-popover/95 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border p-3 shadow-lg shadow-black/5 backdrop-blur-sm motion-safe:duration-200">
      <p className="text-muted-foreground px-1 text-sm">
        You have unsaved changes
      </p>
      <div className="flex items-center gap-2">
        <Button
          disabled={isSubmitting}
          onClick={() => form.reset()}
          type="button"
          variant="ghost"
        >
          Discard
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

export const InlineVariant = ({
  canManage,
  data,
  fetchedAt,
  onSave,
}: ProtoProps) => {
  const formSchema = statusFormSchema(data);

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    values,
    formApi,
  ) => {
    const result = await onSave(toPayload(values));
    if ("error" in result) {
      toast.error("Oops! Something went wrong.", {
        description: result.error.message ?? "Internal server error.",
      });

      return;
    }
    formApi.reset(formApi.state.values);
    if (values.offline !== data.offline) {
      toast.success(values.offline ? "Site is offline" : "Site is online", {
        description: values.offline
          ? "Visitors now see the offline page."
          : "Visitors can use the site again.",
      });
    } else {
      toast.success("Changes saved", {
        description: "Visitors see them the next time the offline page loads.",
      });
    }
  };

  return (
    <AutoForm
      className="flex flex-col gap-0"
      fields={[
        {
          component: props => (
            <AutoFormSwitch
              {...props}
              description="Visitors see the offline page instead of the site. Staff keep full access."
              disabled={!canManage}
              label="Take the site offline"
            />
          ),
          id: "offline",
        },
        {
          component: props => (
            <AutoFormEditor
              {...props}
              className="min-h-40"
              description="Why the site is offline. Write it in the default language at least; other languages fall back to it."
              format="json"
              label="Message"
              multiLang
              placeholder="We're upgrading the forum. Back shortly!"
            />
          ),
          id: "message",
        },
        {
          component: props => (
            <AutoFormDateTime
              {...props}
              description="The site never opens by itself."
              disabled={!canManage}
              label="Opening time"
            />
          ),
          id: "opensAt",
        },
        {
          component: props => (
            <AutoFormSwitch
              {...props}
              description="When off, visitors see only the date."
              disabled={!canManage}
              label="Show countdown"
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
                <CardTitle className="text-base">Opening</CardTitle>
                <CardDescription>
                  Optional. Shows visitors when to come back.
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
