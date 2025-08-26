"use client";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@vitnode/core/components/ui/hover-card";

export default function HoverCardExample() {
  return (
    <HoverCard>
      <HoverCardTrigger>Hover</HoverCardTrigger>
      <HoverCardContent>
        Extendable Framework - created and maintained by @axendev.
      </HoverCardContent>
    </HoverCard>
  );
}
