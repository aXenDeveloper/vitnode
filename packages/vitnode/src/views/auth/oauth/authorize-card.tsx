import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { AuthFrame } from "../auth-card";

/** The consent page's centered card, shared by every state it can be in. */
export const OAuthAuthorizeCard = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <AuthFrame>
    <Card className="gap-0 overflow-hidden p-0">{children}</Card>
  </AuthFrame>
);

export const OAuthAuthorizeSkeleton = () => (
  <div aria-busy="true" className="contents" data-slot="route-pending">
    <span className="sr-only" role="status">
      Loading
    </span>
    <OAuthAuthorizeCard>
      <div aria-hidden="true" className="flex flex-col gap-6 p-6">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="size-12 rounded-xl" />
          <div className="flex w-full flex-col items-center gap-2">
            <Skeleton className="h-6 w-64 max-w-full" />
            <Skeleton className="h-4 w-48 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
      <div
        aria-hidden="true"
        className="bg-muted/40 flex flex-col gap-4 border-t p-6 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Skeleton className="h-9 w-full sm:w-24" />
          <Skeleton className="h-9 w-full sm:w-28" />
        </div>
      </div>
    </OAuthAuthorizeCard>
  </div>
);
