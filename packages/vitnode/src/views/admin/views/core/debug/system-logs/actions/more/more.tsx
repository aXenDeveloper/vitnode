"use client";

import { SearchIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import React from "react";

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ContentMoreActionSystemLogs = dynamic(async () =>
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
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button aria-label={t("title")} size="icon" variant="ghost">
                <SearchIcon />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>{t("title")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

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
