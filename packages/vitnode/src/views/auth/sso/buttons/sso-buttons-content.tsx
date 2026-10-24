import { cn } from "cn";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import type { SSOProvider } from "../providers";

import { ssoBrandColors } from "../brand";
import { SSOProviderIcon } from "./sso-provider-icon";

export type SSOStartResult = undefined | { message?: string };

export type SSOSelectProvider = (providerId: string) => Promise<SSOStartResult>;

// Past this many buttons a single column pushes the email form off screen, so
// they go in two columns with the bare provider name on each button.
const COMPACT_FROM = 5;

const BRAND_FILL =
  "border-transparent bg-(--sso-brand) text-(--sso-brand-foreground) hover:bg-(--sso-brand-hover)";

const brandStyle = (brandColor: string | undefined) => {
  if (!brandColor) return undefined;

  const { foreground, hover } = ssoBrandColors(brandColor);

  return {
    "--sso-brand": brandColor,
    "--sso-brand-foreground": foreground,
    "--sso-brand-hover": hover,
  } as React.CSSProperties;
};

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

  const failToStart = () => {
    setPendingId(null);
    toast.error(tErrors("title"), {
      description: tErrors("internal_server_error"),
    });
  };

  const selectProvider = async (providerId: string) => {
    setPendingId(providerId);

    try {
      const result = await onSelectProvider(providerId);
      if (result?.message) failToStart();
    } catch {
      failToStart();
    }
  };

  const compact = providers.length >= COMPACT_FROM;

  return (
    <>
      <div
        className={cn("grid gap-3", compact ? "grid-cols-2" : "grid-cols-1")}
      >
        {providers.map(provider => (
          <Button
            aria-label={
              compact
                ? t("continue_with", { provider: provider.name })
                : undefined
            }
            className={cn(
              "h-10 w-full min-w-0 [&_img]:size-4.5 [&_svg]:size-4.5 [&>span[aria-hidden]]:size-4.5",
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
            <span className="truncate">
              {compact
                ? provider.name
                : t("continue_with", { provider: provider.name })}
            </span>
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
