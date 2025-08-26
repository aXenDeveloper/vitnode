import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export const Loader = ({
  className,
  small,
}: {
  className?: string;
  small?: boolean;
}) => {
  if (small) {
    return <Loader2 className={cn("size-5 animate-spin", className)} />;
  }

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <Loader2 className={cn("size-10 animate-spin")} />
    </div>
  );
};
