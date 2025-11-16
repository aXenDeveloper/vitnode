"use client";

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
import { type ComponentProps, type Ref, useRef } from "react";

import { LogoVitNode } from "../logo-vitnode";
import { AnimatedBeam } from "./animated-beam";

interface CircleProps extends ComponentProps<typeof Link> {
  anchorRef?: Ref<HTMLAnchorElement>;
  tooltip?: string;
}

const Circle = ({ className, tooltip, anchorRef, ...props }: CircleProps) => {
  const classNameLink = cn(
    "bg-card hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-ring/50 z-10 flex size-12 items-center justify-center rounded-md border p-3 transition-all focus-visible:ring-[3px]",
    className,
  );

  if (!tooltip) {
    return <Link className={classNameLink} ref={anchorRef} {...props} />;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link className={classNameLink} ref={anchorRef} {...props} />
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
          <Circle anchorRef={div1Ref} href="/" tooltip="Users">
            <Users />
          </Circle>
          <Circle
            anchorRef={div8Ref}
            href="/docs/dev/email/overview"
            tooltip="Emails"
          >
            <AtSign />
          </Circle>
          <Circle anchorRef={div5Ref} href="/" tooltip="Plugins">
            <Plug />
          </Circle>
        </div>
        <div className="flex flex-row items-center justify-between">
          <Circle anchorRef={div2Ref} href="/" tooltip="Languages">
            <Languages />
          </Circle>

          <Circle anchorRef={div4Ref} className="size-16" href="/docs/dev">
            <LogoVitNode small />
          </Circle>
          <Circle anchorRef={div6Ref} href="/" tooltip="Themes">
            <Paintbrush />
          </Circle>
        </div>
        <div className="flex flex-row items-center justify-between">
          <Circle anchorRef={div3Ref} href="/" tooltip="Authorization">
            <ShieldCheck />
          </Circle>
          <Circle anchorRef={div9Ref} href="/" tooltip="AI">
            <Sparkle />
          </Circle>
          <Circle anchorRef={div7Ref} href="/" tooltip="Database">
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
