"use client";

import { PencilIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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

const CreateEditRoleAdmin = dynamic(async () =>
  import("../../actions/create-edit/create-edit").then(mod => ({
    default: mod.CreateEditRoleAdmin,
  })),
);

export const EditAction = (
  props: Required<React.ComponentProps<typeof CreateEditRoleAdmin>>,
) => {
  const t = useTranslations("admin.role.edit");

  return (
    <Dialog>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <DialogTrigger
                render={
                  <Button aria-label={t("title")} size="icon" variant="ghost" />
                }
              >
                <PencilIcon />
              </DialogTrigger>
            }
          />
          <TooltipContent>{t("title")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <CreateEditRoleAdmin {...props} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
