"use client";

import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import type { SSOProvider } from "../providers";

export type SSOStartResult = undefined | { message?: string };

export type SSOSelectProvider = (providerId: string) => Promise<SSOStartResult>;

export const SSOButtonsContent = ({
  onSelectProvider,
  providers,
}: {
  onSelectProvider: SSOSelectProvider;
  providers: readonly SSOProvider[];
}) => {
  const t = useTranslations("core.auth.sso");
  const tErrors = useTranslations("core.global.errors");

  if (!providers.length) {
    return null;
  }

  return (
    <>
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>

        <div className="relative flex justify-center text-xs">
          <span className="bg-card text-muted-foreground px-4">{t("or")}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4">
        {providers.map(provider => (
          <Button
            className="bg-card w-[calc(50%-0.5rem)]"
            key={provider.id}
            onClick={async () => {
              const result = await onSelectProvider(provider.id);

              if (result?.message) {
                toast.error(tErrors("title"), {
                  description: tErrors("internal_server_error"),
                });
              }
            }}
            variant="outline"
          >
            {provider.name}
          </Button>
        ))}
      </div>
    </>
  );
};

/** The row's shape while the deployment configuration is still in flight. */
export const SSOButtonsSkeleton = () => (
  <div className="flex gap-4">
    <Skeleton className="mt-6 h-8 w-full" />
    <Skeleton className="mt-6 h-8 w-full" />
  </div>
);
