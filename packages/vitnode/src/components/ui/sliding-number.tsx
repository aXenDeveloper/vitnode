import { cn } from "cn";
import {
  AnimatePresence,
  motion,
  type MotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import React from "react";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const ROLL_SPRING = { stiffness: 220, damping: 22, mass: 0.4 };
const PLACE_TRANSITION = { type: "spring", duration: 0.35, bounce: 0 } as const;

export const digitFaceOffset = (face: number, rolled: number) => {
  const current = ((rolled % 10) + 10) % 10;
  const offset = (10 + face - current) % 10;

  return offset > 5 ? offset - 10 : offset;
};

export const numberPlaces = (value: number) => {
  const length = String(Math.trunc(Math.abs(value))).length;

  return Array.from({ length }, (_, index) => 10 ** (length - index - 1));
};

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
    <motion.span
      className="absolute inset-0 flex items-center justify-center"
      style={{ y }}
    >
      {face}
    </motion.span>
  );
};

const DigitRoller = ({ place, value }: { place: number; value: number }) => {
  const shouldReduceMotion = useReducedMotion();
  const target = Math.floor(Math.abs(value) / place);
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
  const places = numberPlaces(value);

  return (
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
        {value < 0 && <span>-</span>}
        <AnimatePresence initial={false}>
          {places.map(place => (
            <motion.span
              animate={{ opacity: 1, width: "auto" }}
              className="inline-flex overflow-hidden"
              exit={{ opacity: 0, width: 0 }}
              initial={{ opacity: 0, width: 0 }}
              key={place}
              transition={
                shouldReduceMotion ? { duration: 0 } : PLACE_TRANSITION
              }
            >
              <DigitRoller place={place} value={value} />
            </motion.span>
          ))}
        </AnimatePresence>
      </span>
    </span>
  );
}

export { SlidingNumber };
