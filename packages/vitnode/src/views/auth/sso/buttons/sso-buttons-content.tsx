import { cn } from "cn";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";

import type { SSOProvider } from "../providers";

import { LastUsedBadge } from "../../last-used-badge";
import { ssoBrandColors } from "../brand";
import { SSOProviderIcon } from "./sso-provider-icon";

export type SSOStartResult = undefined | { message?: string };

export type SSOSelectProvider = (providerId: string) => Promise<SSOStartResult>;

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
  lastUsedProviderId,
  layout = "grid",
  onSelectProvider,
  providers,
}: {
  lastUsedProviderId?: string;
  layout?: "grid" | "stack";
  onSelectProvider: SSOSelectProvider;
  providers: readonly SSOProvider[];
}) => {
  const t = useTranslations("core.auth.sso");
  const tErrors = useTranslations("core.global.errors");
  const [pendingId, setPendingId] = useState<null | string>(null);
  const headingId = useId();
  const lastUsedBadgeId = useId();

  if (!providers.length) {
    return null;
  }

  const lastUsed = providers.find(
    provider => provider.id === lastUsedProviderId,
  );
  const ordered = lastUsed
    ? [lastUsed, ...providers.filter(provider => provider !== lastUsed)]
    : providers;
  const hasUnpairedLast = (ordered.length - (lastUsed ? 1 : 0)) % 2 === 1;

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

  return (
    <div
      aria-labelledby={headingId}
      className="flex flex-col gap-3"
      role="group"
    >
      <h2 className="text-muted-foreground text-sm font-medium" id={headingId}>
        {t("heading")}
      </h2>

      <div
        className={cn(
          "grid grid-cols-2 gap-2",
          layout === "stack" && "md:grid-cols-1 md:gap-3",
        )}
      >
        {ordered.map((provider, index) => {
          const isLastUsed = provider === lastUsed;

          return (
            <Button
              aria-describedby={isLastUsed ? lastUsedBadgeId : undefined}
              aria-label={t("continue_with", { provider: provider.name })}
              className={cn(
                "h-10 w-full min-w-0 [&_img]:size-4.5 [&_svg]:size-4.5",
                (isLastUsed ||
                  (hasUnpairedLast && index === ordered.length - 1)) &&
                  "col-span-2",
                layout === "stack" && "md:col-span-1 md:h-11",
                isLastUsed && "h-11",
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
              <span className="truncate">{provider.name}</span>
              {isLastUsed ? <LastUsedBadge id={lastUsedBadgeId} /> : null}
            </Button>
          );
        })}
      </div>
    </div>
  );
};
