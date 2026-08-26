/* eslint-disable @eslint-react/set-state-in-effect */
"use client";

import { cn } from "@vitnode/core/lib/utils";
import { motion } from "motion/react";
import { type RefObject, useEffect, useId, useState } from "react";

export const AnimatedBeam = ({
  className,
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  reverse = false,
  // eslint-disable-next-line react-hooks/purity, @eslint-react/purity
  duration = Math.random() * 3 + 4,
  delay = 0,
  pathColor = "gray",
  pathWidth = 2,
  pathOpacity = 0.2,
  gradientStartColor = "#325fbd",
  gradientStopColor = "#363895",
  startXOffset = 0,
  startYOffset = 0,
  endXOffset = 0,
  endYOffset = 0,
}: {
  className?: string;
  containerRef: RefObject<HTMLElement | null>;
  curvature?: number;
  delay?: number;
  duration?: number;
  endXOffset?: number;
  endYOffset?: number;
  fromRef: RefObject<HTMLElement | null>;
  gradientStartColor?: string;
  gradientStopColor?: string;
  pathColor?: string;
  pathOpacity?: number;
  pathWidth?: number;
  reverse?: boolean;
  startXOffset?: number;
  startYOffset?: number;
  toRef: RefObject<HTMLElement | null>;
}) => {
  const id = useId();
  const [pathD, setPathD] = useState("");
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });

  const gradientCoordinates = reverse
    ? {
        x1: ["90%", "-10%"],
        x2: ["100%", "0%"],
        y1: ["0%", "0%"],
        y2: ["0%", "0%"],
      }
    : {
        x1: ["10%", "110%"],
        x2: ["0%", "100%"],
        y1: ["0%", "0%"],
        y2: ["0%", "0%"],
      };

  useEffect(() => {
    const updatePath = () => {
      if (containerRef.current && fromRef.current && toRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const rectA = fromRef.current.getBoundingClientRect();
        const rectB = toRef.current.getBoundingClientRect();

        const svgWidth = containerRect.width;
        const svgHeight = containerRect.height;
        setSvgDimensions({ width: svgWidth, height: svgHeight });

        const startX =
          rectA.left - containerRect.left + rectA.width / 2 + startXOffset;
        const startY =
          rectA.top - containerRect.top + rectA.height / 2 + startYOffset;
        const endX =
          rectB.left - containerRect.left + rectB.width / 2 + endXOffset;
        const endY =
          rectB.top - containerRect.top + rectB.height / 2 + endYOffset;

        const controlY = startY - curvature;
        const d = `M ${startX},${startY} Q ${
          (startX + endX) / 2
        },${controlY} ${endX},${endY}`;
        setPathD(d);
      }
    };

    const resizeObserver = new ResizeObserver(entries => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const _entry of entries) {
        updatePath();
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    updatePath();

    return () => {
      resizeObserver.disconnect();
    };
  }, [
    containerRef,
    fromRef,
    toRef,
    curvature,
    startXOffset,
    startYOffset,
    endXOffset,
    endYOffset,
  ]);

  return (
    <svg
      className={cn(
        "pointer-events-none absolute top-0 left-0 transform-gpu stroke-2",
        className,
      )}
      fill="none"
      height={svgDimensions.height}
      viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
      width={svgDimensions.width}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Animated beam</title>
      <path
        d={pathD}
        stroke={pathColor}
        strokeLinecap="round"
        strokeOpacity={pathOpacity}
        strokeWidth={pathWidth}
      />
      <path
        d={pathD}
        stroke={`url(#${id})`}
        strokeLinecap="round"
        strokeOpacity="1"
        strokeWidth={pathWidth}
      />
      <defs>
        <motion.linearGradient
          animate={{
            x1: gradientCoordinates.x1,
            x2: gradientCoordinates.x2,
            y1: gradientCoordinates.y1,
            y2: gradientCoordinates.y2,
          }}
          className="transform-gpu"
          gradientUnits={"userSpaceOnUse"}
          id={id}
          initial={{
            x1: "0%",
            x2: "0%",
            y1: "0%",
            y2: "0%",
          }}
          transition={{
            delay,
            duration,
            ease: [0.16, 1, 0.3, 1], // https://easings.net/#easeOutExpo
            repeat: Infinity,
            repeatDelay: 0,
          }}
        >
          <stop stopColor={gradientStartColor} stopOpacity="0" />
          <stop stopColor={gradientStartColor} />
          <stop offset="32.5%" stopColor={gradientStopColor} />
          <stop offset="100%" stopColor={gradientStopColor} stopOpacity="0" />
        </motion.linearGradient>
      </defs>
    </svg>
  );
};
