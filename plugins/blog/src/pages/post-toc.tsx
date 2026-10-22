import { cn } from "cn";
import React from "react";

import type { PostHeading } from "./post-outline";

const READING_TOP = 96;
const READING_BOTTOM = 0.5;

const lineX = (level: PostHeading["level"]) => (level === 3 ? 20.5 : 8.5);
const textInset = (level: PostHeading["level"]) => (level === 3 ? 32 : 20);

interface Track {
  d: string;
  height: number;
  spans: [number, number][];
  width: number;
}

const INITIAL_RANGE = "0:0";

const visibleRange = (headings: readonly PostHeading[]): null | string => {
  const elements = headings.map(heading => document.getElementById(heading.id));
  if (!elements.every((element): element is HTMLElement => element !== null)) {
    return null;
  }
  const first = elements[0];
  if (!first) return null;

  const tops = elements.map(element => element.getBoundingClientRect().top);
  const bodyEnd =
    first.closest(".tiptap")?.getBoundingClientRect().bottom ??
    Number.POSITIVE_INFINITY;
  const viewBottom = window.innerHeight * READING_BOTTOM;
  let from = -1;
  let to = -1;

  tops.forEach((top, index) => {
    const start = index === 0 ? Number.NEGATIVE_INFINITY : top;
    const end = tops[index + 1] ?? bodyEnd;
    if (start < viewBottom && end > READING_TOP) {
      if (from === -1) from = index;
      to = index;
    }
  });

  const last = headings.length - 1;

  return from === -1 ? `${last}:${last}` : `${from}:${to}`;
};

const subscribeToScroll = (notify: () => void) => {
  let frame = 0;
  const schedule = () => {
    if (!frame) {
      frame = requestAnimationFrame(() => {
        frame = 0;
        notify();
      });
    }
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
  };
};

const useVisibleSections = (headings: readonly PostHeading[]) => {
  const range = React.useSyncExternalStore(
    subscribeToScroll,
    () => visibleRange(headings) ?? INITIAL_RANGE,
    () => INITIAL_RANGE,
  );
  const [from = 0, to = 0] = range.split(":").map(Number);

  return [from, to] as const;
};

const scrollToHeading = (
  event: React.MouseEvent<HTMLAnchorElement>,
  id: string,
) => {
  const target = document.getElementById(id);
  if (!target) return;

  event.preventDefault();
  target.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "start",
  });
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${window.location.search}#${id}`,
  );
  target.focus({ preventScroll: true });
};

export const PostToc = ({ headings }: { headings: readonly PostHeading[] }) => {
  const listRef = React.useRef<HTMLDivElement>(null);
  const [track, setTrack] = React.useState<null | Track>(null);
  const [from, to] = useVisibleSections(headings);

  React.useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const draw = () => {
      if (list.clientHeight === 0) return;
      let d = "";
      let width = 0;
      let height = 0;
      let previous: null | { bottom: number; x: number } = null;
      const spans: Track["spans"] = [];

      for (const link of list.querySelectorAll<HTMLAnchorElement>(
        "a[data-level]",
      )) {
        const styles = getComputedStyle(link);
        const x = lineX(link.dataset.level === "3" ? 3 : 2);
        const top = link.offsetTop + Number.parseFloat(styles.paddingTop);
        const bottom =
          link.offsetTop +
          link.clientHeight -
          Number.parseFloat(styles.paddingBottom);

        d += previous
          ? ` L${previous.x} ${previous.bottom} L${x} ${top} L${x} ${bottom}`
          : `M${x} ${top} L${x} ${bottom}`;
        spans.push([top, bottom]);
        width = Math.max(width, x + 8);
        height = Math.max(height, bottom);
        previous = { bottom, x };
      }

      setTrack({ d, height, spans, width });
    };

    const observer = new ResizeObserver(draw);
    observer.observe(list);
    draw();

    return () => {
      observer.disconnect();
    };
  }, [headings]);

  const clipTop = track?.spans[from]?.[0] ?? 0;
  const clipBottom = track?.spans[to]?.[1] ?? 0;

  return (
    <div className="relative" ref={listRef}>
      {track ? (
        <>
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-s-0 top-0 rtl:-scale-x-100"
            fill="none"
            height={track.height}
            viewBox={`0 0 ${track.width} ${track.height}`}
            width={track.width}
          >
            <path
              className="stroke-foreground/15"
              d={track.d}
              strokeWidth="1"
            />
          </svg>
          <svg
            aria-hidden="true"
            className="ease-fluid pointer-events-none absolute inset-s-0 top-0 transition-[clip-path] duration-200 motion-reduce:transition-none rtl:-scale-x-100"
            fill="none"
            height={track.height}
            style={{
              clipPath: `inset(${clipTop}px 0 ${track.height - clipBottom}px 0)`,
            }}
            viewBox={`0 0 ${track.width} ${track.height}`}
            width={track.width}
          >
            <path className="stroke-primary" d={track.d} strokeWidth="1" />
          </svg>
        </>
      ) : null}
      <ol className="flex flex-col">
        {headings.map((heading, index) => (
          <li key={heading.id}>
            <a
              aria-current={index === from ? "location" : undefined}
              className={cn(
                "block py-1.5 text-sm leading-snug wrap-anywhere transition-colors duration-150",
                index === 0 && "pt-0",
                index === headings.length - 1 && "pb-0",
                index >= from && index <= to
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              data-level={heading.level}
              href={`#${heading.id}`}
              onClick={event => {
                scrollToHeading(event, heading.id);
              }}
              style={{ paddingInlineStart: textInset(heading.level) }}
            >
              {heading.title}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
};
