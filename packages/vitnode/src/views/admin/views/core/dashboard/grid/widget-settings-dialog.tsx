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

import type { DashboardWidgetView } from "../widgets/types";

import { saveWidgetSettingsMutation } from "../widgets/save-widget-settings.server";

interface WidgetSettingsDialogContextProps {
  /** Dismisses the dialog without writing anything. */
  close: () => void;
  /** A save is in flight - disable the form's controls. */
  isPending: boolean;
  /**
   * Merges these keys into this copy's settings and closes the dialog. Keys you
   * leave out are kept as they were. The write lands immediately - the card
   * itself catches up once the admin leaves edit mode, since reloading the
   * board mid-edit would throw away whatever they have arranged.
   */
  save: (settings: Record<string, unknown>) => void;
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

/**
 * The gear on a card, and the dialog behind it. Rendered alongside the sizing
 * and removal buttons for widgets that registered a `settingsComponent` - so
 * only while the board is being edited.
 */
export const WidgetSettingsDialog = ({
  onSaved,
  widget,
}: {
  /** Tells the board its cards are now a render behind. */
  onSaved: () => void;
  widget: DashboardWidgetView;
}) => {
  const t = useTranslations("admin.dashboard.widgets");
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const close = React.useCallback(() => setOpen(false), []);

  const save = React.useCallback(
    (settings: Record<string, unknown>) => {
      startTransition(async () => {
        const res = await saveWidgetSettingsMutation({
          settings,
          // The copy, never the registered id - that is what keeps two cards of
          // the same widget from writing over each other.
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

        onSaved();
      });
    },
    [onSaved, t, widget.instanceId],
  );

  const value = React.useMemo(
    () => ({ close, isPending, save, widgetId: widget.instanceId }),
    [close, isPending, save, widget.instanceId],
  );

  return (
    <Dialog onOpenChange={setOpen} open={open}>
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
          {widget.settingsContent}
        </WidgetSettingsDialogContext>
      </DialogContent>
    </Dialog>
  );
};
