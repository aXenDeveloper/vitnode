"use client";

import { SearchIcon } from "lucide-react";
import React from "react";
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
import { TooltipWithContent } from "@/components/ui/tooltip";

/**
 * `React.lazy` rather than `next/dynamic`, so this dialog renders in both
 * applications. The two do the same thing here - split the chunk and load it on
 * first render - and the `<React.Suspense>` below was always the boundary either
 * of them suspends against.
 */
const ContentMoreActionSystemLogs = React.lazy(async () =>
  import("./content").then(module => ({
    default: module.ContentMoreActionSystemLogs,
  })),
);

export const MoreActionSystemLogs = (
  props: React.ComponentProps<typeof ContentMoreActionSystemLogs>,
) => {
  const t = useTranslations("admin.debug.logs.more");

  return (
    <Dialog>
      <TooltipWithContent text={t("title")}>
        <DialogTrigger
          render={
            <Button aria-label={t("title")} size="icon" variant="ghost" />
          }
        >
          <SearchIcon />
        </DialogTrigger>
      </TooltipWithContent>

      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SearchIcon className="size-5" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>
            {t.rich("desc", {
              logId: () => <span className="font-semibold">#{props.id}</span>,
            })}
          </DialogDescription>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <ContentMoreActionSystemLogs {...props} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
