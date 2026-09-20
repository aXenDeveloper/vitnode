import type { ReactElement } from "react";

import { Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";

import type { EditorZoneInvalidEntry } from "../state/types";

import { useVisualEditor } from "../context";
import { describeInvalidEntry } from "./classify";

export interface InvalidZoneEntriesProps {
  entries: readonly EditorZoneInvalidEntry[];
  zoneId: string;
}

export const InvalidZoneEntries = ({
  entries,
  zoneId,
}: InvalidZoneEntriesProps): ReactElement => {
  const t = useTranslations("core.editor");
  const { dispatch } = useVisualEditor();

  return (
    <div className="border-destructive/60 bg-destructive/5 flex flex-col gap-3 rounded-md border border-dashed p-4">
      <div className="flex flex-col gap-1">
        <p className="text-destructive flex items-center gap-1.5 text-sm font-medium text-pretty">
          <TriangleAlertIcon aria-hidden="true" className="size-4 shrink-0" />
          {t("zone.invalid.title")}
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
          {t("zone.invalid.description")}
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {entries.map(entry => (
          <li
            className="border-border bg-background flex flex-wrap items-center justify-between gap-2 rounded-md border p-2"
            key={entry.index}
          >
            <code className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
              {describeInvalidEntry(entry.value)}
            </code>

            <Button
              onClick={() => {
                dispatch({
                  index: entry.index,
                  type: "remove-invalid",
                  zoneId,
                });
              }}
              size="sm"
              variant="destructive"
            >
              <Trash2Icon />
              {t("zone.invalid.remove")}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
};
