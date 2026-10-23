import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { AUTH_CARD_VIEW_TRANSITION_NAME, AuthFrame } from "../auth-card";

export const PasswordResetContent = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <AuthFrame>
    <Card style={{ viewTransitionName: AUTH_CARD_VIEW_TRANSITION_NAME }}>
      {children}
    </Card>
  </AuthFrame>
);

/** Either form's shape while the deployment configuration is still in flight. */
export const PasswordResetSkeleton = () => (
  <>
    <CardHeader className="flex flex-col items-center space-y-2 text-center">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-64" />
    </CardHeader>

    <CardContent className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="mt-4 h-9 w-full" />
    </CardContent>
  </>
);
