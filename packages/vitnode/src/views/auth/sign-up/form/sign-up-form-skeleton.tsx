import { cn } from "cn";

import { Skeleton } from "@/components/ui/skeleton";

import { AuthFieldSkeleton } from "../../auth-card";

const CheckboxCardSkeleton = ({ className }: { className: string }) => (
  <div className={cn("flex gap-3 rounded-lg border p-4", className)}>
    <Skeleton className="size-4 shrink-0 rounded-sm" />
    <div className="flex flex-1 flex-col gap-2">
      <Skeleton className="h-3.5 w-40" />
      <Skeleton className="h-3 w-full max-w-56" />
    </div>
  </div>
);

export const SignUpFormSkeleton = ({
  withNewsletter = false,
}: {
  withNewsletter?: boolean;
}) => (
  <div className="flex flex-col gap-8">
    <AuthFieldSkeleton labelClassName="w-20" />
    <AuthFieldSkeleton labelClassName="w-12" />
    <AuthFieldSkeleton labelClassName="w-20" />
    <CheckboxCardSkeleton className="h-24" />
    {withNewsletter ? <CheckboxCardSkeleton className="h-19" /> : null}
    <Skeleton className="h-9 w-full" />
  </div>
);
