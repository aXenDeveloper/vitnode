import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import {
  REVEAL_EXIT_TRANSITION,
  REVEAL_HIDDEN,
  REVEAL_SHOWN,
  REVEAL_TRANSITION,
} from "@/lib/motion";

export const RevealPanel = ({
  children,
  className,
  id,
  open,
}: {
  children: React.ReactNode;
  className?: string;
  id: string;
  open: boolean;
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          animate={REVEAL_SHOWN}
          className={className}
          exit={
            shouldReduceMotion
              ? undefined
              : { ...REVEAL_HIDDEN, transition: REVEAL_EXIT_TRANSITION }
          }
          id={id}
          initial={shouldReduceMotion ? false : REVEAL_HIDDEN}
          key="panel"
          transition={REVEAL_TRANSITION}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
