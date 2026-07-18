"use client";

import { RefreshCwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/lib/navigation";

import { rebuildSearchIndexMutation } from "./mutation-api";

export const RebuildSearchAction = () => {
  const t = useTranslations("core.search");
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const onClick = () => {
    startTransition(async () => {
      const result = await rebuildSearchIndexMutation();

      if (result.error) {
        toast.error(t("admin.rebuildError"));

        return;
      }

      toast.success(t("admin.rebuildQueued"));
      router.refresh();
    });
  };

  return (
    <Button disabled={isPending} onClick={onClick} variant="outline">
      <RefreshCwIcon />
      {isPending ? t("admin.rebuilding") : t("admin.rebuild")}
    </Button>
  );
};
