import { Skeleton } from "@/components/ui/skeleton";

import { AuthFieldSkeleton } from "../../auth-card";

export const SignInFormSkeleton = ({
  withResetPassword = false,
}: {
  withResetPassword?: boolean;
}) => (
  <div className="flex flex-col gap-8">
    <AuthFieldSkeleton labelClassName="w-12" />
    <AuthFieldSkeleton
      labelClassName="w-20"
      withLabelRight={withResetPassword}
    />
    <Skeleton className="h-9 w-full" />
  </div>
);
