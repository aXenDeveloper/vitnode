import type { DevErrorHint } from "./hints";
import type { DevErrorFrame } from "./stack";

import { escapeHtml, highlightLine } from "./highlight";
import { DEV_ERROR_SCRIPT, DEV_ERROR_STYLES } from "./page-assets";

export interface DevErrorPageFrame extends DevErrorFrame {
  displayFile: string;
}

export interface DevErrorPageSource {
  frame: DevErrorPageFrame;
  lines: string[];
  start: number;
}

export type DevErrorRuntime = "browser" | "server";

const RUNTIME_WHERE: Record<DevErrorRuntime, string> = {
  browser: "in the browser",
  server: "on the server",
};

const failedRequestText = ({ method, path, runtime }: DevErrorPageInput) =>
  runtime === "browser"
    ? `<code>${escapeHtml(path)}</code> failed to render in the browser.`
    : `<code>${escapeHtml(method)} ${escapeHtml(path)}</code> failed on the server.`;

export interface DevErrorPageInput {
  dismissible?: boolean;
  docsUrl: string;
  error: { message: string; name: string };
  frames: DevErrorPageFrame[];
  hints: DevErrorHint[];
  method: string;
  path: string;
  runtime: DevErrorRuntime;
  source: DevErrorPageSource | null;
  status: number;
  version: string;
}

const ICON_PATHS = {
  book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  chevronsUpDown: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  external:
    '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
} as const;

type IconName = keyof typeof ICON_PATHS;

const LONG_MESSAGE_LENGTH = 90;

const icon = (name: IconName, className = "") =>
  `<svg class="icon ${className}" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[name]}</svg>`;

const copyIcons = () =>
  `${icon("copy", "icon-copy")}${icon("check", "icon-check")}`;

const location = (frame: DevErrorPageFrame) =>
  `${frame.displayFile}:${String(frame.line)}:${String(frame.column)}`;

const editorTarget = (frame: DevErrorFrame) =>
  `${frame.file}:${String(frame.line)}:${String(frame.column)}`;

const stackText = ({ error, frames }: DevErrorPageInput) =>
  [
    `${error.name}: ${error.message}`,
    ...frames.map(frame => `    at ${frame.functionName} (${location(frame)})`),
  ].join("\n");

const promptText = (input: DevErrorPageInput, hint: DevErrorHint) =>
  [
    "Fix this server error in my VitNode app:",
    "",
    stackText(input),
    "",
    `Suggested approach: ${hint.title}. ${hint.description}`,
    ...(hint.snippet ? [hint.snippet] : []),
  ].join("\n");

const codeFrame = ({ frame, lines, start }: DevErrorPageSource) => {
  const rows = lines
    .map((text, index) => {
      const number = start + index;
      const isError = number === frame.line;
      const row = `<div class="cf-line${isError ? " is-error" : ""}"><span class="cf-num">${String(number)}</span><span>${highlightLine(text) || " "}</span></div>`;
      if (!isError) return row;

      return `${row}<div class="cf-line cf-caret" aria-hidden="true"><span class="cf-num">${String(number)}</span><span>${" ".repeat(Math.max(frame.column - 1, 0))}^</span></div>`;
    })
    .join("");

  return `<figure class="cf">
    <figcaption class="cf-head">
      <span class="cf-path" title="${escapeHtml(location(frame))}">${escapeHtml(frame.displayFile)} <span>(${String(frame.line)}:${String(frame.column)}) @ ${escapeHtml(frame.functionName)}</span></span>
      <button class="icon-btn" type="button" data-open="${escapeHtml(editorTarget(frame))}" aria-label="Open ${escapeHtml(frame.displayFile)} at line ${String(frame.line)} in your editor">${icon("external")}</button>
    </figcaption>
    <div class="cf-body" role="region" aria-label="Source of ${escapeHtml(frame.functionName)}" tabindex="0">${rows}</div>
  </figure>`;
};

const hintsSection = (input: DevErrorPageInput) => {
  if (input.hints.length === 0) return "";

  const cards = input.hints
    .map(
      hint => `<div class="fix">
        <div class="fix-head">
          <div><h3>${escapeHtml(hint.title)}</h3><p>${escapeHtml(hint.description)}</p></div>
          <button type="button" class="chip-btn" data-copy="${escapeHtml(promptText(input, hint))}" aria-label="Copy an AI prompt for: ${escapeHtml(hint.title)}">${copyIcons()}Copy prompt</button>
        </div>
        ${hint.snippet ? `<pre class="snippet">${hint.snippet.split("\n").map(highlightLine).join("\n")}</pre>` : ""}
      </div>`,
    )
    .join("");

  return `<section class="section" aria-labelledby="dev-error-fixes">
    <h2 class="h2" id="dev-error-fixes">Ways to fix this</h2>
    <div class="fixes" data-count="${String(Math.min(input.hints.length, 3))}">${cards}</div>
  </section>`;
};

const frameItem = (frame: DevErrorPageFrame) =>
  frame.isApp
    ? `<li><button type="button" class="frame-open frame-fn" data-open="${escapeHtml(editorTarget(frame))}" aria-label="Open ${escapeHtml(frame.functionName)} in your editor">${escapeHtml(frame.functionName)} ${icon("external")}</button><span class="frame-loc">${escapeHtml(location(frame))}</span></li>`
    : `<li class="is-lib"><span class="frame-fn">${escapeHtml(frame.functionName)}</span><span class="frame-loc">${escapeHtml(location(frame))}</span></li>`;

const stackSection = ({ frames }: DevErrorPageInput) => {
  if (frames.length === 0) return "";

  const appFrames = frames.filter(frame => frame.isApp);
  const libFrames = frames.filter(frame => !frame.isApp);
  const visible = appFrames.length > 0 ? appFrames : libFrames;
  const hidden = appFrames.length > 0 ? libFrames : [];
  const show = `Show ${String(hidden.length)} framework frames`;
  const hide = `Hide ${String(hidden.length)} framework frames`;

  return `<section aria-labelledby="dev-error-stack">
    <div class="stack-head">
      <h2 class="h2" id="dev-error-stack">Call stack <span class="count">${String(frames.length)}</span></h2>
      ${hidden.length > 0 ? `<button type="button" class="text-btn" data-toggle-lib aria-expanded="false" aria-controls="dev-error-lib" data-show="${show}" data-hide="${hide}"><span class="lbl">${show}</span>${icon("chevronsUpDown")}</button>` : ""}
    </div>
    <ul class="frames">${visible.map(frameItem).join("")}</ul>
    ${hidden.length > 0 ? `<ul class="frames" id="dev-error-lib" hidden>${hidden.map(frameItem).join("")}</ul>` : ""}
  </section>`;
};

export const renderDevErrorPage = (input: DevErrorPageInput): string => {
  const { error, status } = input;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(`${error.name}: ${error.message}`.slice(0, 120))}</title>
<script>try{var t=localStorage.getItem("vitnode-dev-error-theme");if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
<style>${DEV_ERROR_STYLES}</style>
</head>
<body${input.dismissible ? " data-dismissible" : ""}>
<main class="page">
  <div class="shell">
    <div class="bar">
      <p class="bar-count">1 error <span>${RUNTIME_WHERE[input.runtime]}</span></p>
      <p class="status-pill">VitNode ${escapeHtml(input.version)}</p>
    </div>
    <article class="card" aria-labelledby="dev-error-title">
      <div class="top">
        <div class="badges">
          <div class="badge-list"><span class="badge badge-error">${escapeHtml(error.name)}</span>${input.runtime === "server" ? `<span class="badge">${String(status)}</span>` : ""}</div>
          <div class="actions">
            <button type="button" class="icon-btn" data-copy="${escapeHtml(stackText(input))}" aria-label="Copy error and stack trace">${copyIcons()}</button>
            <a class="icon-btn" href="${escapeHtml(input.docsUrl)}" target="_blank" rel="noreferrer" aria-label="Open the error page docs">${icon("book")}</a>
            <button type="button" class="icon-btn" data-theme-toggle aria-label="Toggle dark theme">${icon("moon", "icon-moon")}${icon("sun", "icon-sun")}</button>
            ${input.dismissible ? `<button type="button" class="icon-btn" data-close aria-label="Close the error details (Esc)">${icon("close")}</button>` : ""}
          </div>
        </div>
        <h1 class="title${(error.message || error.name).length > LONG_MESSAGE_LENGTH ? " is-long" : ""}" id="dev-error-title"><code>${escapeHtml(error.message || error.name)}</code></h1>
        <p class="desc">${failedRequestText(input)} Fix the code and refresh after you save.</p>
      </div>
      ${input.source ? codeFrame(input.source) : ""}
      ${hintsSection(input)}
      ${stackSection(input)}
    </article>
  </div>
</main>
<div class="sr-only" aria-live="polite" id="dev-error-live"></div>
<script>${DEV_ERROR_SCRIPT}</script>
</body>
</html>`;
};
