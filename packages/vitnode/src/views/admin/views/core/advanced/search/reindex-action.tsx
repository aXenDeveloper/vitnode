"use client";

import { RefreshCwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/lib/navigation";
import { cn } from "@/lib/utils";

import { rebuildSearchIndexMutation } from "./mutation-api";

export const ReindexCollectionAction = ({
  itemType,
  label,
}: {
  itemType: string;
  label: string;
}) => {
  const t = useTranslations("core.search");
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const onClick = () => {
    startTransition(async () => {
      const result = await rebuildSearchIndexMutation(itemType);

      if (result.error) {
        toast.error(t("admin.rebuildError"));

        return;
      }

      toast.success(t("admin.reindexQueued", { collection: label }));
      router.refresh();
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
