"use client";

import { Settings2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";

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

import { loadWidgetSettingsAction } from "../widgets/load-widget-settings.server";
import { saveWidgetSettingsMutation } from "../widgets/save-widget-settings.server";

interface WidgetSettingsDialogContextProps {
  /** Dismisses the dialog without writing anything. */
  close: () => void;
  /** A save is in flight - disable the form's controls. */
  isPending: boolean;
  /**
   * Merges these keys into this copy's settings and closes the dialog. Keys you
   * leave out are kept as they were. Once the write lands, the card behind the
   * dialog is re-rendered on its own - the rest of the board is left alone, so
   * an arrangement in progress survives.
   *
   * Resolves once the write is done, so `AutoForm` can hold its submit button
   * in the loading state for as long as it takes.
   */
  save: (settings: Record<string, unknown>) => Promise<void>;
  /** The copy being configured, e.g. `@vitnode/core:notes#2`. */
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

/** Unwraps the form the server sent back, so the dialog can suspend on it. */
const WidgetSettingsForm = ({
  form,
}: {
  form: Promise<React.ReactNode>;
}): React.ReactNode => React.use(form);

/**
 * The gear on a card, and the dialog behind it. Rendered alongside the sizing
 * and removal buttons for widgets that registered a `settingsComponent` - so
 * only while the board is being edited.
 */
export const WidgetSettingsDialog = ({
  onSaved,
  widget,
}: {
  /** Asks the board to render this card again, against what was just stored. */
  onSaved: () => void;
  widget: DashboardWidgetView;
}) => {
  const t = useTranslations("admin.dashboard.widgets");
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
      loadWidgetSettingsAction({ widgetId: widget.instanceId }).catch(() => (
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
            const res = await saveWidgetSettingsMutation({
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
            toast.success(t("settings.saved_title"), {
              description: t("settings.saved_desc"),
            });

            // Left until the dialog has finished closing. The card suspends
            // while it is re-rendered, and a suspended render mid-animation
            // strands the overlay on screen - batched into this transition it
            // would also hold the close back until the new card was ready.
            setTimeout(onSaved, 300);
          } finally {
            resolve();
          }
        });
      }),
    [onSaved, t, widget.instanceId],
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
