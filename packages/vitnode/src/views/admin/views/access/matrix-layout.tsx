import { cn } from "cn";
import {
  BookOpenIcon,
  EyeIcon,
  MessageSquareIcon,
  PaperclipIcon,
} from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { ContentAccessAction } from "@/content/access/policy";

import { CONTENT_ACCESS_ACTIONS } from "@/content/access/const";

export const MATRIX_ROW =
  "grid grid-cols-7 items-center border-b sm:grid-cols-6";
export const MATRIX_GROUP_CELL =
  "col-span-3 min-w-0 px-4 py-2.5 text-start sm:col-span-2 sm:px-6";
export const MATRIX_ACTION_CELL = "flex justify-center px-1 py-2.5";

const ACTION_ICONS: Record<ContentAccessAction, React.ElementType> = {
  comment: MessageSquareIcon,
  downloadAttachments: PaperclipIcon,
  read: BookOpenIcon,
  view: EyeIcon,
};

/**
 * The sticky column headings of the access matrix - names from `sm` up,
 * icons below it. Shared by the matrix and its skeleton so they line up.
 */
export const ContentAccessMatrixHeader = () => {
  const t = useTranslations("core.access.admin");
  const tMatrix = useTranslations("core.access.admin.matrix");

  return (
    <div className="bg-popover sticky top-0 z-10" role="rowgroup">
      <div
        className={cn(
          MATRIX_ROW,
          "bg-muted/40 text-muted-foreground text-xs font-medium",
        )}
        role="row"
      >
        <div className={cn(MATRIX_GROUP_CELL, "py-2")} role="columnheader">
          {tMatrix("group")}
        </div>
        {CONTENT_ACCESS_ACTIONS.map(action => {
          const Icon = ACTION_ICONS[action];

          return (
            <div
              className="flex justify-center px-1 py-2"
              key={action}
              role="columnheader"
              title={t(`actions.${action}.desc`)}
            >
              <Icon aria-hidden="true" className="size-4 sm:hidden" />
              <span className="max-sm:sr-only">
                {tMatrix(`columns.${action}`)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
