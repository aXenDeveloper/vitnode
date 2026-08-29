"use client";

import { RefreshCwIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { RebuildSearchIndex } from "./search-index-mutations";

/**
 * "Rebuild the whole index", in the screen's header.
 *
 * `onRebuild` is the only thing it cannot decide for itself, and it carries the
 * refresh with it - `router.refresh()` in Next.js, a query invalidation in
 * TanStack Start. See `search-index-mutations.ts` for why that is folded into
 * the callback rather than passed alongside it.
 */
export const SearchHeaderActions = ({
  onRebuild,
}: {
  onRebuild: RebuildSearchIndex;
}) => {
  const t = useTranslations("core.search");
  const [isPending, startTransition] = React.useTransition();

  const rebuild = () => {
    startTransition(async () => {
      const result = await onRebuild();

      if (result.error) {
        toast.error(t("admin.rebuildError"));

        return;
      }

      toast.success(t("admin.rebuildQueued"));
    });
  };

  return (
    <Button disabled={isPending} onClick={rebuild}>
      <RefreshCwIcon className={cn(isPending && "animate-spin")} />
      {isPending ? t("admin.rebuilding") : t("admin.rebuild")}
    </Button>
  );
};
