const LIGHT_TOKENS = `
  color-scheme: light;
  --background: oklch(0.985 0.002 264);
  --foreground: oklch(0.214 0.006 264);
  --card: oklch(1 0 0);
  --muted: oklch(0.97 0.004 264);
  --muted-foreground: oklch(0.5 0.005 264);
  --border: oklch(0.928 0.004 264);
  --primary: oklch(0.52 0.2 264);
  --destructive: oklch(0.565 0.209 27);
  --success: oklch(0.6 0.14 155);
  --code-bg: oklch(0.975 0.003 264);
  --elevation: 0 0 0 1px rgb(0 0 0 / 0.06), 0 1px 3px rgb(0 0 0 / 0.05), 0 12px 32px -12px rgb(0 0 0 / 0.12);
  --elevation-flat: 0 0 0 1px rgb(0 0 0 / 0.07), 0 1px 2px rgb(0 0 0 / 0.04);
`;

const DARK_TOKENS = `
  color-scheme: dark;
  --background: oklch(0.163 0.009 264);
  --foreground: oklch(0.976 0 0);
  --card: oklch(0.199 0.011 264);
  --muted: oklch(0.235 0.014 264);
  --muted-foreground: oklch(0.75 0.012 264);
  --border: oklch(0.269 0.018 264);
  --primary: oklch(0.7 0.14 264);
  --destructive: oklch(0.709 0.17 27);
  --success: oklch(0.78 0.13 155);
  --code-bg: oklch(0.175 0.01 264);
  --elevation: 0 0 0 1px rgb(255 255 255 / 0.08);
  --elevation-flat: 0 0 0 1px rgb(255 255 255 / 0.08);
`;

export const DEV_ERROR_STYLES = `
:root {${LIGHT_TOKENS}
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  --radius: 12px;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {${DARK_TOKENS}}
  :root:not([data-theme="light"]) .icon-moon { display: none; }
  :root:not([data-theme="light"]) .icon-sun { display: block; }
}
:root[data-theme="dark"] {${DARK_TOKENS}}
:root[data-theme="dark"] .icon-moon { display: none; }
:root[data-theme="dark"] .icon-sun { display: block; }
.icon-sun { display: none; }

*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; }
body {
  min-height: 100dvh;
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
  font-size: 15px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-synthesis: none;
}
button, a { touch-action: manipulation; }
button { font: inherit; color: inherit; }
h1, h2, h3, p { margin: 0; }
code { font-family: var(--font-mono); }
:focus-visible { outline: 2px solid var(--muted-foreground); outline-offset: 2px; }
[hidden] { display: none !important; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

.icon { width: 16px; height: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.icon-btn {
  position: relative; display: inline-grid; place-items: center;
  width: 36px; height: 36px; border: 0; border-radius: 8px;
  background: transparent; color: var(--muted-foreground); cursor: pointer;
  transition-property: color, background-color, transform; transition-duration: 150ms; transition-timing-function: ease-out;
}
.icon-btn::before { content: ""; position: absolute; inset: -4px; }
.icon-btn:active { transform: scale(0.96); }
.chip-btn {
  display: inline-flex; align-items: center; gap: 6px;
  height: 32px; padding: 0 12px; border: 0; border-radius: 999px;
  background: var(--card); color: var(--muted-foreground); box-shadow: var(--elevation-flat);
  font-size: 13px; font-weight: 500; white-space: nowrap; cursor: pointer;
  transition-property: color, transform; transition-duration: 150ms; transition-timing-function: ease-out;
}
.chip-btn:active { transform: scale(0.96); }
.chip-btn .icon { width: 14px; height: 14px; }
.text-btn {
  display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 8px; border: 0; border-radius: 8px;
  background: transparent; color: var(--muted-foreground); font-size: 14px; cursor: pointer; transition: color 150ms ease-out;
}
@media (hover: hover) and (pointer: fine) {
  .icon-btn:hover { background: var(--muted); color: var(--foreground); }
  .chip-btn:hover, .text-btn:hover { color: var(--foreground); }
  .frame-open:hover { color: var(--primary); }
}
[data-copied] .icon-copy, :not([data-copied]) > .icon-check { display: none; }
[data-copied] { color: var(--success) !important; }

.badge {
  display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: 6px;
  background: var(--muted); color: var(--muted-foreground);
  font-family: var(--font-mono); font-size: 12.5px; font-weight: 500; white-space: nowrap;
}
.badge-error { background: color-mix(in oklab, var(--destructive) 14%, transparent); color: var(--destructive); }

.page { padding: 24px 16px 48px; }
.shell { max-width: 1040px; margin: 0 auto; padding: 6px; border-radius: 22px; background: var(--muted); box-shadow: var(--elevation); }
.bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; padding: 8px 10px 12px; }
.bar-count { font-size: 14px; font-weight: 600; white-space: nowrap; }
.bar-count span { color: var(--muted-foreground); font-weight: 400; }
.status-pill { display: inline-flex; align-items: center; height: 32px; padding: 0 12px; border-radius: 999px; background: var(--card); box-shadow: var(--elevation-flat); font-size: 13px; white-space: nowrap; }
.card { display: flex; flex-direction: column; gap: 28px; padding: 24px 20px; border-radius: 16px; background: var(--card); box-shadow: var(--elevation-flat); }
.top { display: flex; flex-direction: column; gap: 12px; }
.badges { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 12px; }
.badge-list { display: flex; flex-wrap: wrap; gap: 8px; }
.actions { display: flex; flex: none; gap: 2px; margin-block: -6px; margin-inline-start: auto; }
.title { font-size: 20px; line-height: 1.3; font-weight: 600; letter-spacing: -0.01em; text-wrap: balance; overflow-wrap: anywhere; }
.title.is-long { font-size: 16px; line-height: 1.5; text-wrap: pretty; }
.desc { max-width: 72ch; color: var(--muted-foreground); text-wrap: pretty; overflow-wrap: anywhere; }
.desc code { font-size: 0.92em; color: var(--foreground); }

.cf { margin: 0; overflow: hidden; border-radius: var(--radius); background: var(--code-bg); box-shadow: var(--elevation-flat); }
.cf-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; padding: 4px 4px 4px 16px; border-bottom: 1px solid var(--border); font-family: var(--font-mono); font-size: 13px; }
.cf-path { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cf-path span { color: var(--muted-foreground); }
.cf-body { overflow-x: auto; padding: 12px 0; font-family: var(--font-mono); font-size: 13px; line-height: 1.7; font-variant-numeric: tabular-nums; }
.cf-body::-webkit-scrollbar { height: 8px; }
.cf-body::-webkit-scrollbar-thumb { background: color-mix(in oklab, var(--muted-foreground) 30%, transparent); border-radius: 4px; }
.cf-line { display: flex; min-width: max-content; padding-inline-end: 16px; white-space: pre; }
.cf-num { position: sticky; left: 0; flex: none; width: 56px; padding-inline-end: 16px; text-align: end; color: var(--muted-foreground); background: var(--code-bg); user-select: none; -webkit-user-select: none; }
.cf-line.is-error { background: color-mix(in oklab, var(--destructive) 13%, transparent); box-shadow: inset 2px 0 0 var(--destructive); }
.cf-line.is-error .cf-num { color: var(--destructive); background: color-mix(in oklab, var(--destructive) 13%, var(--code-bg)); }
.cf-caret { color: var(--destructive); font-weight: 700; }
.cf-caret .cf-num { color: transparent; }
.tk-k { color: var(--primary); }
.tk-s { color: var(--success); }
.tk-f { font-weight: 600; }
.tk-t { color: color-mix(in oklab, var(--primary) 55%, var(--foreground)); }
.tk-c, .tk-p { color: var(--muted-foreground); }

.section { display: flex; flex-direction: column; gap: 16px; }
.h2 { display: flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 600; }
.fixes { display: grid; grid-template-columns: 1fr; gap: 16px; }
.fix { display: flex; flex-direction: column; border-radius: var(--radius); background: var(--card); box-shadow: var(--elevation-flat); }
.fix-head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px; }
.fix-head > div { flex: 1 1 14rem; min-width: 0; }
.fix-head h3 { font-size: 15px; font-weight: 600; }
.fix-head p { font-size: 14px; color: var(--muted-foreground); text-wrap: pretty; }
.snippet { flex: 1; margin: 0 4px 4px; padding: 12px 16px; overflow-x: auto; border-radius: 8px; background: var(--code-bg); font-family: var(--font-mono); font-size: 12.5px; line-height: 1.65; white-space: pre; }

.stack-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 12px; }
.h2, .text-btn { white-space: nowrap; }
.count { display: inline-grid; place-items: center; min-width: 26px; height: 22px; padding: 0 6px; border-radius: 999px; background: var(--muted); font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }
.frames { display: flex; flex-direction: column; margin: 12px 0 0; padding: 0; list-style: none; }
.frames li { display: flex; flex-direction: column; gap: 2px; padding: 12px 0; border-top: 1px solid var(--border); }
.frames li:first-child { border-top: 0; }
.frames li.is-lib { opacity: 0.7; }
.frame-fn { font-family: var(--font-mono); font-weight: 600; overflow-wrap: anywhere; }
.frame-loc { font-family: var(--font-mono); font-size: 12.5px; color: var(--muted-foreground); overflow-wrap: anywhere; }
.frame-open { display: inline-flex; align-items: center; gap: 6px; padding: 0; border: 0; background: none; cursor: pointer; text-align: start; transition: color 150ms ease-out; }
.frame-open .icon { width: 14px; height: 14px; color: var(--muted-foreground); }

@media (min-width: 820px) {
  .page { padding-top: 48px; }
  .card { padding: 28px 32px 32px; }
  .title { font-size: 22px; }
  .title.is-long { font-size: 17px; }
  .fixes[data-count="2"] { grid-template-columns: repeat(2, 1fr); }
  .fixes[data-count="3"] { grid-template-columns: repeat(3, 1fr); }
}
@media (prefers-reduced-motion: reduce) {
  .icon-btn, .chip-btn, .text-btn, .frame-open { transition: none; }
}
`;

export const DEV_ERROR_SCRIPT = `
(function () {
  var live = document.getElementById("dev-error-live");
  var announce = function (text) { live.textContent = text; };
  var isDark = function () {
    var theme = document.documentElement.dataset.theme;
    return theme ? theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  };
  var close = function () {
    if (window.parent !== window) window.parent.postMessage({ type: "vitnode:dev-error:close" }, "*");
  };
  if (document.body.hasAttribute("data-dismissible")) {
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") close();
    });
  }
  document.addEventListener("click", function (event) {
    if (event.target.closest("[data-close]")) {
      close();
      return;
    }
    var copy = event.target.closest("[data-copy]");
    if (copy) {
      navigator.clipboard.writeText(copy.dataset.copy).then(function () {
        copy.setAttribute("data-copied", "");
        announce("Copied to clipboard");
        setTimeout(function () { copy.removeAttribute("data-copied"); }, 1500);
      }, function () { announce("Copy failed. Select the text instead."); });
      return;
    }
    var open = event.target.closest("[data-open]");
    if (open) {
      announce("Opening in your editor");
      fetch("/__open-in-editor?file=" + encodeURIComponent(open.dataset.open)).then(function (response) {
        if (!response.ok) announce("Couldn't open your editor. Open the file from the path instead.");
      }, function () { announce("Couldn't open your editor. Open the file from the path instead."); });
      return;
    }
    if (event.target.closest("[data-theme-toggle]")) {
      var next = isDark() ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("vitnode-dev-error-theme", next); } catch (error) {}
      return;
    }
    var toggle = event.target.closest("[data-toggle-lib]");
    if (toggle) {
      var expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!expanded));
      document.getElementById(toggle.getAttribute("aria-controls")).hidden = expanded;
      toggle.querySelector(".lbl").textContent = expanded ? toggle.dataset.show : toggle.dataset.hide;
    }
  });
})();
`;
