"use client";

import { RefreshCwIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { RebuildSearchIndex } from "./search-index-mutations";

export const ReindexCollectionAction = ({
  itemType,
  label,
  onRebuild,
}: {
  itemType: string;
  label: string;
  onRebuild: RebuildSearchIndex;
}) => {
  const t = useTranslations("core.search");
  const [isPending, startTransition] = React.useTransition();

  const onClick = () => {
    startTransition(async () => {
      const result = await onRebuild(itemType);

      if (result.error) {
        toast.error(t("admin.rebuildError"));

        return;
      }

      toast.success(t("admin.reindexQueued", { collection: label }));
    });
  };

  return (
    <Button
      className="text-muted-foreground hover:text-foreground"
      disabled={isPending}
      onClick={onClick}
      size="sm"
      variant="ghost"
    >
      <RefreshCwIcon className={cn(isPending && "animate-spin")} />
      {t("admin.reindex")}
    </Button>
  );
};
