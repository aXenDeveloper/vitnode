import { ChevronRightIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Skeleton } from "@/components/ui/skeleton";

import type { UpdateTimeZone } from "./time-zone-update";

import {
  SETTINGS_INTERACTIVE_ROW,
  SETTINGS_ROW_LABEL,
  SettingsGroup,
} from "../settings-group";
import { timeZoneLabel } from "./time-zone-update";

const TimeZoneEditor = React.lazy(async () =>
  import("./time-zone-editor").then(module => ({
    default: module.TimeZoneEditor,
  })),
);

const TimeZoneEditorSkeleton = () => (
  <div aria-hidden className="flex flex-col gap-3 px-4 py-4">
    <Skeleton className="h-14 w-full rounded-md" />
    <div className="flex justify-end gap-2">
      <Skeleton className="h-9 w-20 rounded-md" />
      <Skeleton className="h-9 w-28 rounded-md" />
    </div>
  </div>
);

export const TimeZoneGroup = ({
  onUpdate,
  timeZone,
}: {
  onUpdate: UpdateTimeZone;
  timeZone: null | string;
}) => {
  const t = useTranslations("core.auth.settings.overview");
  const [isEditing, setIsEditing] = React.useState(false);
  const rowRef = React.useRef<HTMLButtonElement>(null);

  const close = () => {
    setIsEditing(false);
    requestAnimationFrame(() => rowRef.current?.focus());
  };

  return (
    <SettingsGroup footer={t("regionDesc")} title={t("regionTitle")}>
      <li>
        {isEditing ? (
          <React.Suspense fallback={<TimeZoneEditorSkeleton />}>
            <TimeZoneEditor
              onClose={close}
              onUpdate={onUpdate}
              value={timeZone}
            />
          </React.Suspense>
        ) : (
          <button
            className={SETTINGS_INTERACTIVE_ROW}
            onClick={() => {
              setIsEditing(true);
            }}
            ref={rowRef}
            type="button"
          >
            <span className={SETTINGS_ROW_LABEL}>{t("timeZone")}</span>
            <span className="text-muted-foreground min-w-0 flex-1 truncate text-end text-sm">
              {timeZone ? timeZoneLabel(timeZone) : t("timeZoneAuto")}
            </span>
            <span className="sr-only">{t("edit")}</span>
            <ChevronRightIcon
              aria-hidden="true"
              className="text-muted-foreground size-4 shrink-0 rtl:rotate-180"
            />
          </button>
        )}
      </li>
    </SettingsGroup>
  );
};
