// PROTOTYPE site-status-admin: throwaway picker, delete after the decision.
import React from "react";

import type { ProtoProps } from "./shared";

import { CurrentVariant } from "./v1-current";
import { InlineVariant } from "./v2-inline";
import { ControlVariant } from "./v3-control";

const VARIANTS = [
  { Component: CurrentVariant, name: "Current" },
  { Component: InlineVariant, name: "Inline" },
  { Component: ControlVariant, name: "Control panel" },
];

const PICKER_CSS = `
.proto-picker{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483647;display:flex;align-items:center;gap:2px;padding:4px;border-radius:999px;background:rgba(10,10,10,.82);-webkit-backdrop-filter:blur(12px) saturate(1.4);backdrop-filter:blur(12px) saturate(1.4);box-shadow:0 0 0 1px rgba(255,255,255,.08) inset,0 8px 24px rgba(0,0,0,.24),0 2px 6px rgba(0,0,0,.12);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px;line-height:1;-webkit-font-smoothing:antialiased;user-select:none;-webkit-user-select:none}
.proto-picker-highlight{position:absolute;top:4px;left:0;height:28px;border-radius:999px;background:rgba(255,255,255,.12);will-change:transform}
.proto-picker[data-ready] .proto-picker-highlight{transition:transform 250ms cubic-bezier(.23,1,.32,1),width 250ms cubic-bezier(.23,1,.32,1)}
@media (prefers-reduced-motion:reduce){.proto-picker[data-ready] .proto-picker-highlight{transition:none}}
.proto-picker-item{position:relative;display:flex;align-items:center;height:28px;padding:0 12px;border:0;border-radius:999px;background:transparent;color:rgba(255,255,255,.55);font:inherit;cursor:pointer;transition:color 150ms ease-out}
.proto-picker-item:hover{color:rgba(255,255,255,.85)}
.proto-picker-item:active{transform:scale(.97)}
.proto-picker-item:focus-visible{outline:2px solid rgba(255,255,255,.4);outline-offset:2px}
.proto-picker-item[data-active]{color:#fff}
.proto-picker-divider{width:1px;height:16px;margin:0 4px;background:rgba(255,255,255,.12)}
.proto-picker-replay{padding:0 10px;font-size:14px}
.proto-picker[data-position="top"]{bottom:auto;top:24px}
`;

const readVariant = () => {
  const v = Number(new URLSearchParams(window.location.search).get("v"));

  return Number.isInteger(v) && v >= 1 && v <= VARIANTS.length ? v - 1 : 0;
};

export const SiteStatusProto = (props: ProtoProps) => {
  const [active, setActive] = React.useState(0);
  const navRef = React.useRef<HTMLElement>(null);
  const highlightRef = React.useRef<HTMLSpanElement>(null);
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  // The server renders variant 1; the URL's variant is applied after hydration.
  React.useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect, react-you-might-not-need-an-effect/no-initialize-state
    setActive(readVariant());
  }, []);

  const select = React.useCallback((i: number) => {
    if (i < 0 || i >= VARIANTS.length) return;
    setActive(i);
    const url = new URL(window.location.href);
    url.searchParams.set("v", String(i + 1));
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const moveHighlight = React.useCallback(() => {
    const el = itemRefs.current[active];
    const highlight = highlightRef.current;
    if (!el || !highlight) return;
    highlight.style.width = `${el.offsetWidth}px`;
    highlight.style.transform = `translateX(${el.offsetLeft}px)`;
  }, [active]);

  React.useLayoutEffect(moveHighlight, [moveHighlight]);

  React.useEffect(() => {
    window.addEventListener("resize", moveHighlight);
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        navRef.current?.setAttribute("data-ready", ""),
      ),
    );

    return () => {
      window.removeEventListener("resize", moveHighlight);
      cancelAnimationFrame(frame);
    };
  }, [moveHighlight]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
        target.isContentEditable
      )
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const num = Number.parseInt(e.key, 10);
      if (num >= 1 && num <= VARIANTS.length) select(num - 1);
      else if (e.key === "ArrowRight") select((active + 1) % VARIANTS.length);
      else if (e.key === "ArrowLeft")
        select((active - 1 + VARIANTS.length) % VARIANTS.length);
    };
    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, [active, select]);

  const { Component } = VARIANTS[active];

  return (
    <>
      <style>{PICKER_CSS}</style>
      <Component key={active} {...props} />
      <nav
        aria-label="Prototype variants"
        className="proto-picker"
        data-position="top"
        ref={navRef}
      >
        <span
          aria-hidden="true"
          className="proto-picker-highlight"
          ref={highlightRef}
        />
        {VARIANTS.map((variant, i) => (
          <button
            aria-current={i === active ? "true" : undefined}
            className="proto-picker-item"
            data-active={i === active ? "" : undefined}
            key={variant.name}
            onClick={() => select(i)}
            ref={el => {
              itemRefs.current[i] = el;
            }}
            type="button"
          >
            {variant.name}
          </button>
        ))}
      </nav>
    </>
  );
};
