"use client";

import { Settings2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader } from "@/components/ui/loader";

import type { DashboardWidgetView } from "../widgets/types";

import { useDashboardBoard } from "./board-provider";

interface WidgetSettingsDialogContextProps {
  close: () => void;
  isPending: boolean;
  save: (settings: Record<string, unknown>) => Promise<void>;
  widgetId: string;
}

const WidgetSettingsDialogContext =
  React.createContext<null | WidgetSettingsDialogContextProps>(null);

/**
 * Saves and closes the settings dialog a widget's form is rendered inside.
 * Available to any client component under a widget's `settingsComponent`.
 */
export const useWidgetSettingsDialog = () => {
  const context = React.use(WidgetSettingsDialogContext);
  if (!context) {
    throw new Error(
      "useWidgetSettingsDialog must be used within a widget's settings dialog.",
    );
  }

  return context;
};

const WidgetSettingsForm = ({
  form,
}: {
  form: Promise<React.ReactNode>;
}): React.ReactNode => React.use(form);

/**
 * One widget's settings, in a dialog.
 *
 * The form itself is not shipped with the board: it is loaded on first open, so
 * an ordinary dashboard load pays for no settings form at all. Both the load and
 * the save come from the board's `actions` - in Next.js they are server actions
 * that render the widget's `settingsComponent` on the server and end in
 * `revalidatePath`; in TanStack Start they are a browser render and a call to
 * the same Hono route. See `../widgets/dashboard-actions.ts`.
 */
export const WidgetSettingsDialog = ({
  onSaved,
  widget,
}: {
  onSaved: () => void;
  widget: DashboardWidgetView;
}) => {
  const t = useTranslations("admin.dashboard.widgets");
  const { actions } = useDashboardBoard();
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [form, setForm] = React.useState<null | Promise<React.ReactNode>>(null);

  const [formKey, setFormKey] = React.useState(widget.contentKey);
  if (formKey !== widget.contentKey) {
    setFormKey(widget.contentKey);
    setForm(null);
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next || form) return;

    setForm(
      actions
        .loadWidgetSettings(widget.instanceId)
        .catch(() => (
          <p className="text-destructive text-sm">{t("settings.load_error")}</p>
        )),
    );
  };

  const close = React.useCallback(() => setOpen(false), []);

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

            setOpen(false);
            setTimeout(onSaved, 300);
          } finally {
            resolve();
          }
        });
      }),
    [actions, onSaved, t, widget.instanceId],
  );

  const value = React.useMemo(
    () => ({ close, isPending, save, widgetId: widget.instanceId }),
    [close, isPending, save, widget.instanceId],
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogTrigger
        render={
          <Button
            aria-label={t("settings.open", { title: widget.title })}
            size="icon-sm"
            variant="secondary"
          />
        }
      >
        <Settings2Icon />
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("settings.title", { title: widget.title })}
          </DialogTitle>
          <DialogDescription>{t("settings.desc")}</DialogDescription>
        </DialogHeader>

        <WidgetSettingsDialogContext value={value}>
          {form ? (
            <React.Suspense fallback={<Loader />}>
              <WidgetSettingsForm form={form} />
            </React.Suspense>
          ) : (
            <Loader />
          )}
        </WidgetSettingsDialogContext>
      </DialogContent>
    </Dialog>
  );
};
