import { cn } from "cn";
import {
  OTPInput,
  OTPInputContext,
  REGEXP_ONLY_CHARS,
  REGEXP_ONLY_DIGITS,
  REGEXP_ONLY_DIGITS_AND_CHARS,
} from "input-otp";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import React from "react";

import { MotionFeatures } from "@/components/motion-features";

const slotValueHidden = { opacity: 0, y: 8, scale: 0.8 };
const slotValueVisible = { opacity: 1, y: 0, scale: 1 };

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string;
}) {
  return (
    <OTPInput
      className={cn("disabled:cursor-not-allowed", className)}
      containerClassName={cn(
        "cn-input-otp group/input-otp flex items-center gap-2 has-disabled:opacity-50",
        containerClassName,
      )}
      data-slot="input-otp"
      spellCheck={false}
      {...props}
    />
  );
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 items-center gap-2", className)}
      data-slot="input-otp-group"
      {...props}
    />
  );
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  index: number;
}) {
  const inputOTPContext = React.use(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {};
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      className={cn(
        "border-input bg-card dark:bg-input/30 data-active:border-ring data-active:ring-ring/50 group-has-aria-invalid/input-otp:border-destructive group-has-aria-invalid/input-otp:data-active:ring-destructive/20 dark:group-has-aria-invalid/input-otp:data-active:ring-destructive/40 relative flex h-10 w-10 min-w-0 items-center justify-center rounded-md border text-lg font-medium tabular-nums shadow-xs transition-[border-color,box-shadow] duration-150 ease-out outline-none data-active:z-10 data-active:ring-3 motion-reduce:transition-none",
        className,
      )}
      data-active={isActive ? "" : undefined}
      data-filled={char ? "" : undefined}
      data-slot="input-otp-slot"
      {...props}
    >
      <MotionFeatures>
        <AnimatePresence initial={false}>
          {char ? (
            <m.span
              animate={slotValueVisible}
              className="origin-bottom"
              data-slot="input-otp-slot-value"
              initial={shouldReduceMotion ? false : slotValueHidden}
              key={char}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              {char}
            </m.span>
          ) : null}
        </AnimatePresence>
      </MotionFeatures>
      {hasFakeCaret ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink bg-foreground h-4 w-0.5 rounded-full" />
        </div>
      ) : null}
    </div>
  );
}

function InputOTPSeparator({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "bg-muted-foreground/40 h-0.5 w-2 shrink-0 rounded-full",
        className,
      )}
      data-slot="input-otp-separator"
      {...props}
    />
  );
}

export {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
  REGEXP_ONLY_CHARS,
  REGEXP_ONLY_DIGITS,
  REGEXP_ONLY_DIGITS_AND_CHARS,
};
