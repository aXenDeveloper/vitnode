"use client";

import { HomeIcon, RefreshCwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/lib/navigation";
import { cn } from "@/lib/utils";

import { ErrorView } from "./error-view";

export interface RouteErrorViewProps {
  error: Error & { digest?: string };
  retry: () => void;
}

export const RouteErrorView = ({ error, retry }: RouteErrorViewProps) => {
  const t = useTranslations("core.global");
  const [isRetrying, startRetry] = useTransition();

  return (
    <ErrorView
      code={500}
      customActions={
        <>
          <Button
            isLoading={isRetrying}
            onClick={() => {
              startRetry(() => {
                retry();
              });
            }}
            size="lg"
          >
            <RefreshCwIcon />
            {t("errors.try_again")}
          </Button>

          <Link
            className={cn(buttonVariants({ size: "lg", variant: "ghost" }))}
            href="/"
          >
            <HomeIcon />
            {t("back_home")}
          </Link>
        </>
      }
      customDescription={
        <>
          {t("errors.500.desc")}
          {error.digest ? (
            <span className="text-muted-foreground/70 mt-2 block font-mono text-xs">
              {t("errors.reference", { digest: error.digest })}
            </span>
          ) : null}
        </>
      }
    />
  );
};
