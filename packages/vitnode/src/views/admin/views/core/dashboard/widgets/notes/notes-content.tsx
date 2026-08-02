"use client";

import { AlertTriangleIcon, CheckIcon, LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { saveWidgetSettingsMutation } from "../save-widget-settings.server";

const AUTOSAVE_DELAY = 1200;
export const NOTES_MAX_LENGTH = 10_000;

export const NotesContent = ({
  defaultValue,
  widgetId,
}: {
  defaultValue: string;
  widgetId: string;
}) => {
  const t = useTranslations("admin.dashboard.widgets.notes");
  const [value, setValue] = React.useState(defaultValue);
  const [status, setStatus] = React.useState<
    "error" | "idle" | "saved" | "saving"
  >("idle");
  const savedValueRef = React.useRef(defaultValue);

  React.useEffect(() => {
    if (value === savedValueRef.current) return;

    const timeout = setTimeout(async () => {
      setStatus("saving");
      const pending = value;
      const res = await saveWidgetSettingsMutation({
        settings: { content: pending },
        widgetId,
      });

      // Say so rather than letting the indicator go quietly blank - a note that
      // looks saved and is not is worse than no note at all. The next keystroke
      // retries, since the effect runs again on every change.
      if (res?.error) {
        setStatus("error");

        return;
      }

      savedValueRef.current = pending;
      setStatus("saved");
    }, AUTOSAVE_DELAY);

    return () => clearTimeout(timeout);
  }, [value, widgetId]);

  return (
    <div className="flex h-full flex-col gap-2">
      <Textarea
        aria-label={t("title")}
        className="min-h-32 flex-1 resize-none"
        maxLength={NOTES_MAX_LENGTH}
        onChange={event => {
          setValue(event.target.value);
          setStatus("idle");
        }}
        placeholder={t("placeholder")}
        value={value}
      />

      <p
        aria-live="polite"
        className={cn(
          "flex min-h-5 items-center gap-1.5 text-xs",
          status === "error" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {status === "error" && (
          <>
            <AlertTriangleIcon className="size-3" />
            {t("error")}
          </>
        )}
        {status === "saving" && (
          <>
            <LoaderCircleIcon className="size-3 animate-spin" />
            {t("saving")}
          </>
        )}
        {status === "saved" && (
          <>
            <CheckIcon className="size-3" />
            {t("saved")}
          </>
        )}
      </p>
    </div>
  );
};
