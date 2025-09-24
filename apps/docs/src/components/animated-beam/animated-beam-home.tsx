"use client";

import type React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@vitnode/core/components/ui/tooltip";
import { Link } from "@vitnode/core/lib/navigation";
import { cn } from "@vitnode/core/lib/utils";
import {
  AtSign,
  Database,
  Languages,
  Paintbrush,
  Plug,
  ShieldCheck,
  Sparkle,
  Users,
} from "lucide-react";
import { useRef } from "react";

import { LogoVitNode } from "../logo-vitnode";
import { AnimatedBeam } from "./animated-beam";

const Circle = ({
  className,
  tooltip,
  ...props
}: React.ComponentProps<typeof Link> & {
  tooltip?: string;
}) => {
  const classNameLink = cn(
    "bg-card hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-ring/50 z-10 flex size-12 items-center justify-center rounded-md border p-3 transition-all focus-visible:ring-[3px]",
    className,
  );

  if (!tooltip) {
    return <Link className={classNameLink} {...props} />;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link className={classNameLink} {...props} />
        </TooltipTrigger>

        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

Circle.displayName = "Circle";

export function AnimatedBeamHome() {
  const containerRef = useRef<HTMLDivElement>(null);
  const div1Ref = useRef<HTMLAnchorElement>(null);
  const div2Ref = useRef<HTMLAnchorElement>(null);
  const div3Ref = useRef<HTMLAnchorElement>(null);
  const div4Ref = useRef<HTMLAnchorElement>(null);
  const div5Ref = useRef<HTMLAnchorElement>(null);
  const div6Ref = useRef<HTMLAnchorElement>(null);
  const div7Ref = useRef<HTMLAnchorElement>(null);
  const div8Ref = useRef<HTMLAnchorElement>(null);
  const div9Ref = useRef<HTMLAnchorElement>(null);

  return (
    <div
      className="relative flex w-full items-center justify-center overflow-hidden p-4 sm:max-w-md"
      ref={containerRef}
    >
      <div className="flex size-full max-w-lg flex-col items-stretch justify-between gap-10">
        <div className="flex flex-row items-center justify-between">
          <Circle href="/" ref={div1Ref} tooltip="Users">
            <Users />
          </Circle>
          <Circle
            href="/docs/dev/email/overview"
            ref={div8Ref}
            tooltip="Emails"
          >
            <AtSign />
          </Circle>
          <Circle href="/" ref={div5Ref} tooltip="Plugins">
            <Plug />
          </Circle>
        </div>
        <div className="flex flex-row items-center justify-between">
          <Circle href="/" ref={div2Ref} tooltip="Languages">
            <Languages />
          </Circle>

          <Circle className="size-16" href="/docs/dev" ref={div4Ref}>
            <LogoVitNode small />
          </Circle>
          <Circle href="/" ref={div6Ref} tooltip="Themes">
            <Paintbrush />
          </Circle>
        </div>
        <div className="flex flex-row items-center justify-between">
          <Circle href="/" ref={div3Ref} tooltip="Authorization">
            <ShieldCheck />
          </Circle>
          <Circle href="/" ref={div9Ref} tooltip="AI">
            <Sparkle />
          </Circle>
          <Circle href="/" ref={div7Ref} tooltip="Database">
            <Database />
          </Circle>
        </div>
      </div>

      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div1Ref}
        toRef={div4Ref}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div2Ref}
        toRef={div4Ref}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div3Ref}
        toRef={div4Ref}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div5Ref}
        reverse
        toRef={div4Ref}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div6Ref}
        reverse
        toRef={div4Ref}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div7Ref}
        reverse
        toRef={div4Ref}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div8Ref}
        toRef={div4Ref}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div9Ref}
        toRef={div4Ref}
      />
    </div>
  );
}
