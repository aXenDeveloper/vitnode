"use client";

import { useTranslations } from "next-intl";
import React from "react";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { useWidgetSettingsDialog } from "../../grid/widget-settings-dialog";

export const SendNotificationSettingsForm = ({
  defaultTitle,
}: {
  defaultTitle: string;
}) => {
  const t = useTranslations("admin.dashboard.widgets.send-notification");
  const tCore = useTranslations("core.global");
  const { close, isPending, save } = useWidgetSettingsDialog();
  const [value, setValue] = React.useState(defaultTitle);
  const id = React.useId();

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={event => {
        event.preventDefault();
        // Emptied on purpose means "go back to the built-in greeting", so it is
        // stored as an empty string rather than left out of the merge.
        save({ defaultTitle: value.trim() });
      }}
    >
      <Field>
        <FieldLabel htmlFor={id}>{t("settings.message")}</FieldLabel>
        <Input
          autoFocus
          disabled={isPending}
          id={id}
          onChange={event => setValue(event.target.value)}
          placeholder={t("default_message")}
          value={value}
        />
        <FieldDescription>{t("settings.message_desc")}</FieldDescription>
      </Field>

      <DialogFooter>
        <Button
          disabled={isPending}
          onClick={close}
          type="button"
          variant="outline"
        >
          {tCore("cancel")}
        </Button>
        <Button disabled={isPending} type="submit">
          {tCore("save")}
        </Button>
      </DialogFooter>
    </form>
  );
};
