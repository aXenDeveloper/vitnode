import { cn } from "cn";
import {
  AnimatePresence,
  type MotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import * as m from "motion/react-m";
import React from "react";

import { MotionFeatures } from "@/components/motion-features";

import { digitFaceOffset, numberPlaces } from "./sliding-number-utils";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const ROLL_SPRING = { stiffness: 220, damping: 22, mass: 0.4 };
const PLACE_TRANSITION = { type: "spring", duration: 0.35, bounce: 0 } as const;
const DigitFace = ({
  face,
  rolled,
}: {
  face: number;
  rolled: MotionValue<number>;
}) => {
  const y = useTransform(rolled, latest => {
    return `${digitFaceOffset(face, latest) * 100}%`;
  });

  return (
    <m.span
      className="absolute inset-0 flex items-center justify-center"
      style={{ y }}
    >
      {face}
    </m.span>
  );
};

const DigitRoller = ({
  exponent,
  fractionDigits,
  scaled,
}: {
  exponent: number;
  fractionDigits: number;
  scaled: number;
}) => {
  const shouldReduceMotion = useReducedMotion();
  const target = Math.floor(scaled / 10 ** (exponent + fractionDigits));
  const rolled = useSpring(target, ROLL_SPRING);

  React.useEffect(() => {
    if (shouldReduceMotion) {
      rolled.jump(target);

      return;
    }

    rolled.set(target);
  }, [rolled, shouldReduceMotion, target]);

  return (
    <span className="relative inline-block w-[1ch] overflow-y-clip">
      <span className="invisible">0</span>
      {DIGITS.map(face => (
        <DigitFace face={face} key={face} rolled={rolled} />
      ))}
    </span>
  );
};

function SlidingNumber({
  className,
  value,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  value: number;
}) {
  const shouldReduceMotion = useReducedMotion();
  const { exponents, fractionDigits, scaled } = numberPlaces(value);

  return (
    <MotionFeatures>
      <span
        className={cn("inline-flex items-center tabular-nums", className)}
        data-slot="sliding-number"
        {...props}
      >
        <span className="sr-only" data-slot="sliding-number-value">
          {value}
        </span>
        <span
          aria-hidden="true"
          className="inline-flex items-center leading-none"
        >
          {value < 0 && scaled > 0 && <span>-</span>}
          <AnimatePresence initial={false}>
            {exponents.map(exponent => (
              <m.span
                animate={{ opacity: 1, width: "auto" }}
                className="inline-flex overflow-hidden"
                exit={{ opacity: 0, width: 0 }}
                initial={{ opacity: 0, width: 0 }}
                key={exponent}
                transition={
                  shouldReduceMotion ? { duration: 0 } : PLACE_TRANSITION
                }
              >
                {exponent === -1 && <span>.</span>}
                <DigitRoller
                  exponent={exponent}
                  fractionDigits={fractionDigits}
                  scaled={scaled}
                />
              </m.span>
            ))}
          </AnimatePresence>
        </span>
      </span>
    </MotionFeatures>
  );
}

export { SlidingNumber };
