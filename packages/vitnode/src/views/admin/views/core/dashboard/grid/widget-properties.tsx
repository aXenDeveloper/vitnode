import { ChevronLeftIcon, LayoutGridIcon, Trash2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TooltipWithContent } from "@/components/ui/tooltip";

import type {
  AdminDashboardWidgetSpan,
  DashboardWidgetView,
} from "../widgets/types";

import { useDashboardBoard } from "./board-context";
import { WIDGET_SPANS } from "./resize";
import { SPAN_LABELS } from "./resize-handle";
import { WidgetSettingsDialogContext } from "./widget-settings-context";

const SEGMENT_CLASS =
  "text-muted-foreground hover:text-foreground aria-pressed:bg-card aria-pressed:text-foreground flex-1 transition-[background-color,color,box-shadow] duration-150 hover:bg-transparent aria-pressed:shadow-sm motion-reduce:transition-none";

const SettingsForm = ({
  form,
}: {
  form: Promise<React.ReactNode>;
}): React.ReactNode => React.use(form);

const PanelSection = ({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) => (
  <section className="flex flex-col gap-4">
    <h3 className="text-muted-foreground text-xs leading-relaxed font-medium tracking-wider uppercase">
      {title}
    </h3>

    {children}
  </section>
);

const SizeSwitch = <T extends number>({
  label,
  labelOf,
  onChange,
  options,
  value,
}: {
  label: string;
  labelOf: (option: T) => string;
  onChange: (option: T) => void;
  options: readonly { disabled?: boolean; value: T }[];
  value: T;
}) => {
  const labelId = React.useId();

  return (
    <div className="flex flex-col gap-2">
      <Label id={labelId}>{label}</Label>

      <ToggleGroup
        aria-labelledby={labelId}
        className="bg-muted w-full rounded-lg p-0.5"
        onValueChange={next => {
          const picked = options.find(
            option => String(option.value) === next[0],
          );

          if (picked) onChange(picked.value);
        }}
        spacing={0.5}
        value={[String(value)]}
      >
        {options.map(option => (
          <ToggleGroupItem
            className={SEGMENT_CLASS}
            disabled={option.disabled}
            key={option.value}
            size="sm"
            value={String(option.value)}
          >
            {labelOf(option.value)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
};

const WidgetSettingsSection = ({ widget }: { widget: DashboardWidgetView }) => {
  const t = useTranslations("admin.dashboard.widgets");
  const { actions, refreshWidget, select } = useDashboardBoard();
  const [isPending, startTransition] = React.useTransition();
  const [form] = React.useState(async () =>
    actions
      .loadWidgetSettings(widget.instanceId)
      .catch(() => (
        <p className="text-destructive text-sm">{t("settings.load_error")}</p>
      )),
  );

  const save = React.useCallback(
    async (settings: Record<string, unknown>) =>
      new Promise<void>(resolve => {
        startTransition(async () => {
          try {
            const res = await actions.saveWidgetSettings({
              settings,
              widgetId: widget.instanceId,
            });

            if (res?.error) {
              toast.error(t("settings.error_title"), {
                description: t("settings.error_desc"),
              });

              return;
            }

            toast.success(t("settings.saved_title"), {
              description: t("settings.saved_desc", { title: widget.title }),
            });
            refreshWidget(widget.instanceId);
          } finally {
            resolve();
          }
        });
      }),
    [actions, refreshWidget, t, widget.instanceId, widget.title],
  );

  const value = React.useMemo(
    () => ({
      close: () => {
        select(null);
      },
      isPending,
      save,
      widgetId: widget.instanceId,
    }),
    [isPending, save, select, widget.instanceId],
  );

  return (
    <WidgetSettingsDialogContext value={value}>
      <React.Suspense fallback={<Loader />}>
        <SettingsForm form={form} />
      </React.Suspense>
    </WidgetSettingsDialogContext>
  );
};

export const WidgetPropertiesPanel = ({
  widget,
}: {
  widget: DashboardWidgetView;
}) => {
  const t = useTranslations("admin.dashboard.widgets");
  const { dispatch, select } = useDashboardBoard();

  const resize = (span: AdminDashboardWidgetSpan) => {
    dispatch({ id: widget.instanceId, span, type: "resize" });
  };

  return (
    <section
      aria-label={t("properties.title", { title: widget.title })}
      className="flex flex-col"
      data-dashboard-properties=""
    >
      <header className="border-sidebar-border bg-sidebar sticky top-0 z-10 flex items-center gap-2 border-b p-4">
        <TooltipWithContent text={t("panel.back")}>
          <Button
            aria-label={t("panel.back")}
            className="-ms-2"
            onClick={() => {
              select(null);
            }}
            size="icon-sm"
            variant="ghost"
          >
            <ChevronLeftIcon className="rtl:rotate-180" />
          </Button>
        </TooltipWithContent>

        <span
          aria-hidden="true"
          className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-sm [&_svg]:size-4"
        >
          {widget.icon ?? <LayoutGridIcon />}
        </span>

        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate text-sm leading-relaxed font-semibold">
            {widget.title}
          </h2>
          <p className="text-muted-foreground truncate text-xs leading-relaxed">
            {widget.category.title}
          </p>
        </div>

        <TooltipWithContent text={t("remove", { title: widget.title })}>
          <Button
            aria-label={t("remove", { title: widget.title })}
            className="hover:bg-destructive/10 hover:text-destructive -me-2"
            onClick={() => {
              dispatch({ id: widget.instanceId, type: "remove" });
            }}
            size="icon-sm"
            variant="ghost"
          >
            <Trash2Icon />
          </Button>
        </TooltipWithContent>
      </header>

      <div className="flex flex-col gap-8 p-4">
        <PanelSection title={t("size.section")}>
          <SizeSwitch
            label={t("size.width")}
            labelOf={span => t(SPAN_LABELS[span])}
            onChange={resize}
            options={WIDGET_SPANS.map(span => ({
              disabled: span < widget.minSpan,
              value: span,
            }))}
            value={widget.span}
          />
        </PanelSection>

        <PanelSection title={t("settings.section")}>
          {widget.hasSettings ? (
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
                {t("settings.desc")}
              </p>

              <WidgetSettingsSection
                key={`${widget.instanceId}:${widget.contentKey}`}
                widget={widget}
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
              {t("settings.none")}
            </p>
          )}
        </PanelSection>
      </div>
    </section>
  );
};
