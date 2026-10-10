import {
  AnimatePresence,
  type Transition,
  useReducedMotion,
} from "motion/react";
import * as m from "motion/react-m";

import type { ContentLiveMember } from "@/content/live/protocol";

import { MotionFeatures } from "@/components/motion-features";

import {
  contentLiveLabelColor,
  contentLiveMemberColor,
} from "./presence-model";

export type ContentLiveOutlineMember = Pick<
  ContentLiveMember,
  "avatarColor" | "name" | "userId"
>;

const GLIDE: Transition = {
  layout: { duration: 0.38, ease: [0.65, 0, 0.25, 1] },
  opacity: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
};

const EXIT: Transition = { duration: 0.15, ease: "easeIn" };

export const ContentLiveFieldOutline = ({
  members,
}: {
  members: readonly ContentLiveOutlineMember[];
}) => {
  const reduced = useReducedMotion();
  const holder = members.at(0);
  const transition = reduced ? { duration: 0 } : GLIDE;
  const exit = { opacity: 0, transition: reduced ? { duration: 0 } : EXIT };
  const color = holder ? contentLiveMemberColor(holder.avatarColor) : "";

  return (
    <MotionFeatures withLayoutAndDrag>
      <AnimatePresence initial={false}>
        {holder ? (
          <m.span
            animate={{ opacity: 1 }}
            aria-hidden
            className="pointer-events-none absolute -inset-1.5 border-2"
            data-slot="content-live-outline"
            exit={exit}
            initial={{ opacity: 0 }}
            key={`ring-${holder.userId}`}
            layoutId={`content-live-ring-${holder.userId}`}
            style={{ borderColor: color, borderRadius: 10 }}
            transition={transition}
          />
        ) : null}
        {holder ? (
          <m.span
            animate={{ opacity: 1 }}
            aria-hidden
            className="pointer-events-none absolute -start-1.5 -top-1.5 z-10 inline-flex max-w-48 -translate-y-full items-center gap-1 px-2 py-1 text-xs leading-none font-semibold whitespace-nowrap select-none"
            data-slot="content-live-tag"
            exit={exit}
            initial={{ opacity: 0 }}
            key={`tag-${holder.userId}`}
            layoutId={`content-live-tag-${holder.userId}`}
            style={{
              backgroundColor: color,
              borderRadius: "6px 6px 6px 0",
              color: contentLiveLabelColor(color),
            }}
            transition={transition}
          >
            <span className="truncate">{holder.name}</span>
            {members.length > 1 ? (
              <span className="tabular-nums">+{members.length - 1}</span>
            ) : null}
          </m.span>
        ) : null}
      </AnimatePresence>
    </MotionFeatures>
  );
};
