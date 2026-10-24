import { cn } from "cn";

import { Skeleton } from "@/components/ui/skeleton";

import { TextLineSkeleton } from "../../auth-card";

export const SSOButtonsSkeleton = ({
  count = 2,
  layout = "grid",
}: {
  count?: number;
  layout?: "grid" | "stack";
}) => (
  <div className="flex flex-col gap-3">
    <TextLineSkeleton className="w-24" />

    <div
      className={cn(
        "grid grid-cols-2 gap-2",
        layout === "stack" && "md:grid-cols-1 md:gap-3",
      )}
    >
      {Array.from({ length: count }, (_, index) => (
        <Skeleton
          className={cn(
            "h-10 w-full",
            count % 2 === 1 && index === count - 1 && "col-span-2",
            layout === "stack" && "md:col-span-1 md:h-11",
          )}
          key={index}
        />
      ))}
    </div>
  </div>
);
