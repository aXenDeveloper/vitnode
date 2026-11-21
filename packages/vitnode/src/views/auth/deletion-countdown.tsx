import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useFormatter } from "use-intl";

import { COUNT_ENTER, type MotionEnter } from "@/lib/motion";

export const DeletionCountdown = ({
  caption,
  days,
  enter,
  label,
}: {
  caption: React.ReactNode;
  days: number;
  enter?: MotionEnter;
  label: string;
}) => {
  const format = useFormatter();
  const shouldReduceMotion = useReducedMotion();

  return (
    <m.div
      {...(shouldReduceMotion ? {} : enter)}
      className="bg-muted/60 flex w-full flex-col items-center gap-1 rounded-lg border p-4 text-center"
    >
      <p className="flex items-baseline gap-2">
        <m.span
          {...(shouldReduceMotion ? {} : COUNT_ENTER)}
          className="text-foreground text-4xl font-semibold tracking-tight tabular-nums"
        >
          {format.number(days)}
        </m.span>
        <span className="text-muted-foreground text-sm">{label}</span>
      </p>
      <p className="text-muted-foreground text-sm leading-relaxed">{caption}</p>
    </m.div>
  );
};
