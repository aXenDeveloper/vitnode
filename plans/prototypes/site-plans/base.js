// Prototype harness for the site plans. Throwaway code: it exists to flip between plans.
// Each variant calls `ctx.render(plan)` with plain data; this file turns it into the sheet.

const STATUS = {
  exists: "On the site",
  new: "New",
  planned: "Planned",
  reworked: "Reworked",
};

const stage = document.getElementById("stage");
const picker = document.querySelector(".proto-picker");
const highlight = picker.querySelector(".proto-picker-highlight");
const axis = document.getElementById("proto-axis");

const state = { outlines: "closed" };
let current = 0;
let mountToken = 0;

const escapeHtml = (text) =>
  String(text).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);

// `[[planned]]` inside any string becomes the amber marker; `code` spans use backticks.
const rich = (text) =>
  escapeHtml(text)
    .replaceAll("[[planned]]", '<span class="soon">Planned</span>')
    .replace(/`([^`]+)`/g, "<code>$1</code>");

const tag = (status) => `<span class="tag" data-status="${status}">${STATUS[status]}</span>`;

const repeat = (count, html) => Array.from({ length: count }, () => html).join("");

const SKETCH = {
  b: () => '<span class="sk-b"></span>',
  big: () => '<span class="sk-big"></span>',
  cards: (n) => `<span class="sk-row">${repeat(n, '<span class="sk-card"></span>')}</span>`,
  checks: (n) => repeat(n, '<span class="sk-check"></span>'),
  chips: (n) => `<span class="sk-row">${repeat(n, '<span class="sk-chip"></span>')}</span>`,
  cols: (n) => `<span class="sk-row">${repeat(n, '<span class="sk-col"></span>')}</span>`,
  dots: (n) => `<span class="sk-dots">${repeat(n, "<span></span>")}</span>`,
  frame: () => '<span class="sk-frame"><span></span><span></span><span></span></span>',
  ghosts: (n) => `<span class="sk-row">${repeat(n, '<span class="sk-ghost"></span>')}</span>`,
  h: () => '<span class="sk-h"></span>',
  hl: () => '<span class="sk-hl"></span>',
  l: () => '<span class="sk-l"></span>',
  mix: (n) =>
    `<span class="sk-row"><span class="sk-card"></span>${repeat(n, '<span class="sk-ghost"></span>')}</span>`,
  path: (n) => `<span class="sk-path">${repeat(n, "<span></span>")}</span>`,
  s: () => '<span class="sk-s"></span>',
  slider: () => '<span class="sk-slider"></span>',
  term: () => '<span class="sk-term"></span>',
};

const sketch = (spec) =>
  `<div class="sk" aria-hidden="true">${spec
    .split(" ")
    .map((token) => {
      const [name, count] = token.split(":");

      return SKETCH[name](Number(count) || 1);
    })
    .join("")}</div>`;

const chevron =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

const band = (section, index) => `
  <li class="band">
    <div class="band-main">
      <div class="band-meta">
        <span class="band-index">${String(index + 1).padStart(2, "0")}</span>
        <span class="eyebrow">${rich(section.job)}</span>
        ${tag(section.status)}
      </div>
      <h3>${rich(section.headline)}</h3>
      <p class="band-body">${rich(section.body)}</p>
      ${
        section.cta
          ? `<div class="band-ctas">${section.cta
              .map(
                (label, ctaIndex) =>
                  `<span class="wf-btn"${ctaIndex === 0 && section.primary !== false ? ' data-kind="primary"' : ""}>${rich(label)}</span>`,
              )
              .join("")}</div>`
          : ""
      }
      <dl class="band-notes">
        <div><dt>Visual</dt><dd>${rich(section.visual)}</dd></div>
        <div><dt>Backed by</dt><dd>${rich(section.proof)}</dd></div>
      </dl>
    </div>
    ${sketch(section.sketch)}
  </li>`;

const page = (entry, id) => `
  <li class="pg">
    <div class="pg-top">
      <span class="pg-url">${escapeHtml(entry.url)}</span>
      ${tag(entry.status)}
    </div>
    <h3>${rich(entry.h1)}</h3>
    <p class="pg-job">${rich(entry.job)}</p>
    <div class="pg-foot">
      <p class="pg-cta"><span>CTA</span><span class="wf-btn">${rich(entry.cta)}</span></p>
      <button class="pg-toggle" type="button" aria-expanded="false" aria-controls="${id}">
        <span>Outline, ${entry.outline.length} sections</span>${chevron}
      </button>
    </div>
    <ol class="pg-outline" id="${id}" hidden>
      ${entry.outline.map((line) => `<li><span>${rich(line)}</span></li>`).join("")}
    </ol>
  </li>`;

const renderPlan = (root, plan) => {
  const pageCount = plan.groups.reduce((sum, group) => sum + group.pages.length, 0);
  let pageIndex = 0;

  root.innerHTML = `
    <div class="wrap plan-inner">
      <header class="plan-head">
        <div class="plan-intro">
          <p class="eyebrow">Plan ${plan.id} of ${VARIANTS.length}</p>
          <h1 id="v${plan.id}-title">${rich(plan.name)}</h1>
          <p class="plan-principle">${rich(plan.principle)}</p>
          <p class="plan-summary">${rich(plan.summary)}</p>
        </div>
        <dl class="plan-facts">
          ${plan.facts.map(([label, text]) => `<div><dt>${rich(label)}</dt><dd>${rich(text)}</dd></div>`).join("")}
        </dl>
      </header>

      <div class="plan-body">
        <section class="part" aria-labelledby="v${plan.id}-home">
          <div class="part-head">
            <h2 id="v${plan.id}-home">Home page, top to bottom</h2>
            <p>${plan.home.length} sections</p>
          </div>
          <div class="sheet">
            <div class="sheet-nav" role="img" aria-label="Proposed top navigation: ${escapeHtml(plan.nav.join(", "))}, then the button Get started free">
              <span class="sheet-logo">VitNode</span>
              <span class="sheet-nav-scroll">${plan.nav.map((item) => `<span>${rich(item)}</span>`).join("")}</span>
              <span class="wf-btn" data-kind="primary">Get started free</span>
            </div>
            <ol>${plan.home.map(band).join("")}</ol>
          </div>
        </section>

        <section class="part part-map" aria-labelledby="v${plan.id}-map">
          <div class="part-head">
            <h2 id="v${plan.id}-map">Subpages</h2>
            <p>${pageCount} pages</p>
          </div>
          <div class="map" tabindex="0" role="group" aria-label="Subpage list">
            ${plan.groups
              .map(
                (group) => `
              <div class="map-group">
                <div class="map-group-head">
                  <p class="eyebrow">${rich(group.title)}</p>
                  ${group.note ? `<p>${rich(group.note)}</p>` : ""}
                </div>
                <ul class="map-list">${group.pages.map((entry) => page(entry, `v${plan.id}-pg-${pageIndex++}`)).join("")}</ul>
              </div>`,
              )
              .join("")}
          </div>
        </section>
      </div>

      <footer class="bets">
        <div>
          <h2>What this plan bets on</h2>
          <ul>${plan.bets.map((line) => `<li><span>${rich(line)}</span></li>`).join("")}</ul>
        </div>
        <div>
          <h2>What it costs</h2>
          <ul>${plan.costs.map((line) => `<li><span>${rich(line)}</span></li>`).join("")}</ul>
        </div>
        <div>
          <h2>First three pages to build</h2>
          <ol>${plan.first.map((line) => `<li><span>${rich(line)}</span></li>`).join("")}</ol>
        </div>
      </footer>
    </div>`;

  applyOutlines(root);
};

const setOutline = (button, open) => {
  button.setAttribute("aria-expanded", String(open));
  document.getElementById(button.getAttribute("aria-controls")).hidden = !open;
};

const applyOutlines = (root) => {
  const open = state.outlines === "open";

  root.toggleAttribute("data-expand-all", open);
  for (const button of root.querySelectorAll(".pg-toggle")) setOutline(button, open);
};

stage.addEventListener("click", (event) => {
  const button = event.target.closest(".pg-toggle");

  if (!button) return;

  stage.firstElementChild?.removeAttribute("data-expand-all");
  setOutline(button, button.getAttribute("aria-expanded") !== "true");
});

const items = VARIANTS.map((variant) => {
  const button = document.createElement("button");

  button.className = "proto-picker-item";
  button.type = "button";
  button.textContent = variant.name;
  picker.append(button);

  return button;
});

const moveHighlight = () => {
  const el = items[current];

  highlight.style.width = `${el.offsetWidth}px`;
  highlight.style.transform = `translateX(${el.offsetLeft}px)`;
};

const mount = (index) => {
  const token = ++mountToken;

  stage.innerHTML = "";
  axis.textContent = VARIANTS[index].axis;

  requestAnimationFrame(() => {
    if (token !== mountToken) return;

    const variant = VARIANTS[index];

    stage.innerHTML = variant.html;

    const root = stage.firstElementChild;

    variant.mount(root, { render: (plan) => renderPlan(root, plan), root });
    window.scrollTo(0, 0);
  });
};

const setActive = (index) => {
  if (index < 0 || index >= VARIANTS.length) return;

  current = index;
  items.forEach((el, itemIndex) => {
    el.toggleAttribute("data-active", itemIndex === index);
    if (itemIndex === index) el.setAttribute("aria-current", "true");
    else el.removeAttribute("aria-current");
  });
  moveHighlight();
  items[index].scrollIntoView({ block: "nearest", inline: "nearest" });

  try {
    const url = new URL(location.href);

    url.searchParams.set("v", index + 1);
    history.replaceState(null, "", url);
  } catch {
    // Sandboxed viewers may refuse history writes; the picker still works.
  }

  mount(index);
};

items.forEach((el, index) => el.addEventListener("click", () => setActive(index)));
window.addEventListener("resize", moveHighlight);

document.addEventListener("keydown", (event) => {
  const target = event.target;

  if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  const digit = Number.parseInt(event.key, 10);

  if (digit >= 1 && digit <= VARIANTS.length) setActive(digit - 1);
  else if (event.key === "ArrowRight") setActive((current + 1) % VARIANTS.length);
  else if (event.key === "ArrowLeft") setActive((current - 1 + VARIANTS.length) % VARIANTS.length);
});

// ---- Control panel ----
const panelToggle = document.querySelector(".proto-panel-toggle");
const panelBody = document.getElementById("proto-panel-body");

panelToggle.addEventListener("click", () => {
  panelBody.hidden = !panelBody.hidden;
  panelToggle.setAttribute("aria-expanded", String(!panelBody.hidden));
});

const controls = {
  outlines(value) {
    state.outlines = value;
    if (stage.firstElementChild) applyOutlines(stage.firstElementChild);
  },
  theme(value) {
    if (value === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", value);
  },
};

for (const group of document.querySelectorAll(".proto-seg")) {
  group.addEventListener("click", (event) => {
    const button = event.target.closest("button");

    if (!button) return;

    for (const other of group.querySelectorAll("button")) {
      other.setAttribute("aria-pressed", String(other === button));
    }

    controls[group.dataset.control](button.dataset.value);
  });
}

const params = new URLSearchParams(location.search);
const initial = (Number.parseInt(params.get("v"), 10) || 1) - 1;

if (params.get("outlines") === "open") {
  state.outlines = "open";
  for (const button of document.querySelectorAll('[data-control="outlines"] button')) {
    button.setAttribute("aria-pressed", String(button.dataset.value === "open"));
  }
}

setActive(initial >= 0 && initial < VARIANTS.length ? initial : 0);
// Enable the slide only after first paint, so load doesn't animate.
requestAnimationFrame(() => requestAnimationFrame(() => picker.setAttribute("data-ready", "")));
