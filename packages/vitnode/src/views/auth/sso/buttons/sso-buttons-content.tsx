import { cn } from "cn";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import type { SSOProvider } from "../providers";

import { ssoBrandForeground } from "../brand";
import { SSOProviderIcon } from "./sso-provider-icon";

export type SSOStartResult = undefined | { message?: string };

export type SSOSelectProvider = (providerId: string) => Promise<SSOStartResult>;

const BRAND_FILL =
  "border-transparent bg-(--sso-brand) text-(--sso-brand-foreground) hover:bg-(--sso-brand) hover:brightness-90 dark:hover:brightness-110";

const brandStyle = (brandColor: string | undefined) =>
  brandColor
    ? ({
        "--sso-brand": brandColor,
        "--sso-brand-foreground": ssoBrandForeground(brandColor),
      } as React.CSSProperties)
    : undefined;

export const SSOButtonsContent = ({
  onSelectProvider,
  providers,
  showDivider = true,
}: {
  onSelectProvider: SSOSelectProvider;
  providers: readonly SSOProvider[];
  showDivider?: boolean;
}) => {
  const t = useTranslations("core.auth.sso");
  const tErrors = useTranslations("core.global.errors");
  const [pendingId, setPendingId] = useState<null | string>(null);

  if (!providers.length) {
    return null;
  }

  const selectProvider = async (providerId: string) => {
    setPendingId(providerId);
    const result = await onSelectProvider(providerId);

    if (result?.message) {
      setPendingId(null);
      toast.error(tErrors("title"), {
        description: tErrors("internal_server_error"),
      });
    }
  };

  return (
    <>
      <div className="flex flex-col gap-3">
        {providers.map(provider => (
          <Button
            className={cn(
              "h-10 w-full [&_img]:size-4.5 [&_svg]:size-4.5 [&>span]:size-4.5",
              provider.brandColor && BRAND_FILL,
            )}
            disabled={pendingId !== null && pendingId !== provider.id}
            isLoading={pendingId === provider.id}
            key={provider.id}
            onClick={async () => selectProvider(provider.id)}
            style={brandStyle(provider.brandColor)}
            variant={provider.brandColor ? "default" : "outline"}
          >
            <SSOProviderIcon provider={provider} />
            {t("continue_with", { provider: provider.name })}
          </Button>
        ))}
      </div>

      {showDivider ? (
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>

          <div className="relative flex justify-center text-xs">
            <span className="bg-card text-muted-foreground px-4">
              {t("or")}
            </span>
          </div>
        </div>
      ) : null}
    </>
  );
};

/** The row's shape while the deployment configuration is still in flight. */
export const SSOButtonsSkeleton = () => (
  <div className="mb-6 flex flex-col gap-3">
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
  </div>
);
