"use client";

import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import type { SSOProvider } from "../providers";

/**
 * What starting an SSO flow answers with.
 *
 * A message means it failed; the shared row turns that into the internal-error
 * toast. On the happy path the browser has already been sent to the provider,
 * so there is nothing to return - the promise simply never resolves to anything
 * the row can render.
 */
export type SSOStartResult = undefined | { message?: string };

export type SSOSelectProvider = (providerId: string) => Promise<SSOStartResult>;

/**
 * The provider buttons, separated from what pressing one does.
 *
 * The whole of the framework boundary is `onSelectProvider`: it takes a
 * provider id and answers whether the flow could be started. Next.js calls a
 * server action that redirects; TanStack Start calls the API and moves the
 * browser itself. Neither is imported here.
 *
 * The failure toast stays on this side deliberately. It is the same message for
 * the same reason in both frameworks - "we could not reach the provider" - and
 * a callback that only reports the failure keeps every wrapper from having to
 * re-implement it.
 */
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
