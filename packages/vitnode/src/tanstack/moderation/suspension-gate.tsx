import type { QueryClient } from "@tanstack/react-query";

import { redirect, useLocation, useNavigate } from "@tanstack/react-router";
import React from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { sessionQueryOptions, useSessionQuery } from "../auth/session-query";
import { RouteMessages } from "../i18n/route-messages";
import { REPORT_NAMESPACES } from "./report-button";

const SuspensionDialogContent = React.lazy(
  async () =>
    await import("@/views/moderation/warnings/suspension-dialog-content"),
);

export const SUSPENDED_HOME_PATH = "/";

const keepDialogOpen = () => {};

export const redirectSuspendedSession = (
  queryClient: QueryClient,
  pathname: string,
): void => {
  const session = queryClient.getQueryData(sessionQueryOptions().queryKey);
  if (!session?.suspension || pathname === SUSPENDED_HOME_PATH) return;

  // oxlint-disable-next-line typescript/only-throw-error
  throw redirect({ replace: true, to: SUSPENDED_HOME_PATH });
};

const DialogSkeleton = () => (
  <div aria-busy="true" className="flex flex-col items-center gap-6 p-8">
    <Skeleton className="size-22 rounded-full" />
    <Skeleton className="h-6 w-2/3" />
    <Skeleton className="h-12 w-1/2" />
    <Skeleton className="h-32 w-full" />
  </div>
);

const SuspensionDialog = ({ endsAt }: { endsAt: Date | null }) => (
  <Dialog disablePointerDismissal onOpenChange={keepDialogOpen} open>
    <DialogContent className="gap-0 p-0 sm:max-w-md" showCloseButton={false}>
      <React.Suspense fallback={<DialogSkeleton />}>
        <SuspensionDialogContent endsAt={endsAt} />
      </React.Suspense>
    </DialogContent>
  </Dialog>
);

export const SuspensionGate = () => {
  const { data } = useSessionQuery();
  const suspension = data?.suspension;
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const away = !!suspension && pathname !== SUSPENDED_HOME_PATH;

  React.useEffect(() => {
    if (away) void navigate({ replace: true, to: SUSPENDED_HOME_PATH });
  }, [away, navigate]);

  if (!suspension || away) return null;

  return (
    <RouteMessages namespaces={REPORT_NAMESPACES}>
      <SuspensionDialog
        endsAt={suspension.endsAt ? new Date(suspension.endsAt) : null}
      />
    </RouteMessages>
  );
};
