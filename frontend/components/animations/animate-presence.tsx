"use client";

import { AnimatePresence, type AnimatePresenceProps } from "framer-motion";
import type { ReactNode } from "react";

interface Props extends AnimatePresenceProps {
  children: ReactNode;
}

export const AnimatePresenceClient = ({ children, ...props }: Props) => {
  return <AnimatePresence {...props}>{children}</AnimatePresence>;
};
