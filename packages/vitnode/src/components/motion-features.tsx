import type React from "react";

import { LazyMotion } from "motion/react";

const loadDomAnimation = async () =>
  import("@/lib/motion-features/dom-animation").then(res => res.default);

const loadDomMax = async () =>
  import("@/lib/motion-features/dom-max").then(res => res.default);

export const MotionFeatures = ({
  children,
  withLayoutAndDrag = false,
}: {
  children: React.ReactNode;
  withLayoutAndDrag?: boolean;
}) => (
  <LazyMotion features={withLayoutAndDrag ? loadDomMax : loadDomAnimation}>
    {children}
  </LazyMotion>
);
