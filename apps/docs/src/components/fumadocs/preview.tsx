import { Loader } from "@vitnode/core/components/ui/loader";
import { cn } from "@vitnode/core/lib/utils";
import dynamic from "next/dynamic";
import React from "react";

export const Preview = ({
  name,
  className,
  withoutBackground,
}: {
  className?: string;
  name: string;
  withoutBackground?: boolean;
}) => {
  const Component = dynamic(async () => import(`../../examples/${name}.tsx`));

  if (withoutBackground) {
    return (
      <div className="[&_p]:m-0 [&_table]:my-0 [&_table]:rounded-md [&_table]:border-none [&_table]:bg-transparent">
        <React.Suspense fallback={<Loader />} key={name}>
          <Component />
        </React.Suspense>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "from-fd-primary/1 bg-card/50 flex min-h-[450px] items-center justify-center rounded-xl border bg-gradient-to-br p-6 *:max-w-[30rem] [&_p]:m-0",
        className,
      )}
    >
      <React.Suspense fallback={<Loader />} key={name}>
        <Component />
      </React.Suspense>
    </div>
  );
};
