import { cn } from "cn";
import { ChevronRightIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CONTENT_ACCESS_ACTIONS } from "@/content/access/const";

import {
  ContentAccessMatrixHeader,
  MATRIX_ACTION_CELL,
  MATRIX_GROUP_CELL,
  MATRIX_ROW,
} from "./matrix-layout";

const GroupLabel = ({ desc, label }: { desc: string; label: string }) => (
  <div className={MATRIX_GROUP_CELL}>
    <span className="flex flex-col">
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground text-xs">{desc}</span>
    </span>
  </div>
);

const CheckboxCells = () =>
  CONTENT_ACCESS_ACTIONS.map(action => (
    <div className={MATRIX_ACTION_CELL} key={action}>
      <Skeleton className="size-4 rounded-sm" />
    </div>
  ));

/**
 * The access dialog while its rules load: the real headings, group names and
 * Cancel, with placeholders where the switches, boxes, notes and Save will be -
 * the same rows and heights, so nothing moves when the data arrives.
 */
export const ContentAccessMatrixSkeleton = () => {
  const t = useTranslations("core.access.admin");
  const tMatrix = useTranslations("core.access.admin.matrix");
  const tGlobal = useTranslations("core.global");

  return (
    <div aria-busy="true" className="flex min-h-0 flex-1 flex-col">
      <span className="sr-only" role="status">
        {t("effective.loading")}
      </span>

      <div
        aria-hidden="true"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto text-sm"
      >
        <ContentAccessMatrixHeader />

        <div className={MATRIX_ROW}>
          <div className={cn(MATRIX_GROUP_CELL, "py-3")}>
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{tMatrix("inherit.label")}</span>
              <span className="text-muted-foreground text-xs leading-relaxed text-pretty">
                {tMatrix("inherit.desc")}
              </span>
            </span>
          </div>
          {CONTENT_ACCESS_ACTIONS.map(action => (
            <div className="self-start px-1 py-3" key={action}>
              <span className="flex flex-col items-center gap-1">
                <Skeleton className="h-4 w-7 rounded-full" />
                <span className="hidden h-8 flex-col items-center justify-center gap-1.5 sm:flex">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-3 w-16" />
                </span>
              </span>
            </div>
          ))}
        </div>

        <div className={MATRIX_ROW}>
          <GroupLabel
            desc={tMatrix("guests.desc")}
            label={tMatrix("guests.label")}
          />
          <CheckboxCells />
        </div>

        <div className={MATRIX_ROW}>
          <GroupLabel
            desc={tMatrix("members.desc")}
            label={tMatrix("members.label")}
          />
          <CheckboxCells />
        </div>

        <div className={MATRIX_ROW}>
          <div className="col-span-3 min-w-0 px-2 py-1.5 sm:col-span-2 sm:px-4">
            <span className="flex items-center gap-2 px-2 py-1.5">
              <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
              <span className="flex flex-col gap-1">
                <span className="font-medium">{tMatrix("roles.label")}</span>
                <Skeleton className="h-3 w-12" />
              </span>
            </span>
          </div>
          {CONTENT_ACCESS_ACTIONS.map(action => (
            <div className="px-1 py-1.5" key={action}>
              <span className="flex flex-col items-center gap-1">
                <Skeleton className="size-4 rounded-sm" />
                <Skeleton className="h-3 w-6" />
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 px-4 py-4 sm:px-6">
          <span className="flex items-center gap-2">
            <Skeleton className="size-4 shrink-0" />
            <Skeleton className="h-3.5 w-3/4" />
          </span>
        </div>
      </div>

      <div className="bg-muted/50 flex items-center justify-end gap-2 border-t px-4 py-4 sm:px-6">
        <DialogClose
          render={<Button variant="ghost">{tGlobal("cancel")}</Button>}
        />
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  );
};
