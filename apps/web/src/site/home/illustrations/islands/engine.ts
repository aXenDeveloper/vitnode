import { createRuntime, type Spring } from "./runtime";

export const ISLAND_PARTS = [
  "forum",
  "blog",
  "shop",
  "booking",
  "members",
  "payments",
] as const;

export type IslandPart = (typeof ISLAND_PARTS)[number];

export interface IslandsCopy {
  all: { off: string; on: string };
  bridge: (name: string) => string;
  captions: Record<"people" | IslandPart, string>;
  clearSkies: string;
  cut: string;
  home: string;
  lowered: string;
  names: Record<IslandPart, string>;
  react: Record<"cloud" | "flock" | "plank" | "walker", string>;
}

interface Plank {
  el: HTMLElement;
  gone: number;
  shown: number;
  t0: number;
  x: number;
  y: number;
  z: number;
}

interface Chain {
  l: Float32Array;
  lv: Float32Array;
  v: Float32Array;
  vv: Float32Array;
}

interface Isle {
  angle: number;
  ax: number;
  ay: number;
  back: boolean;
  bob: number;
  bx: number;
  by: number;
  chain: Chain;
  chip: HTMLElement;
  dip: Spring;
  el: HTMLElement;
  flag: HTMLElement;
  key: HTMLElement;
  n: number;
  open: boolean;
  planks: Plank[];
  ring: HTMLElement;
  rise: null | Spring;
  spot: HTMLElement;
  ux: number;
  uy: number;
  x: number;
  y: number;
  z: number;
}

const ANGLE: Record<IslandPart, number> = {
  blog: 232,
  booking: 308,
  forum: 165,
  members: 15,
  payments: 62,
  shop: 118,
};
const ROOF: Record<IslandPart, number> = {
  blog: 0.78,
  booking: 0.94,
  forum: 0.32,
  members: 0.42,
  payments: 0.4,
  shop: 0.28,
};
const WAVE: IslandPart[] = [
  "forum",
  "blog",
  "booking",
  "members",
  "payments",
  "shop",
];
const REST: IslandPart[] = ["forum"];
const CHIP_ABOVE_ROOF: IslandPart[] = ["blog", "booking", "members"];
const HOME_HALF = 0.75;
const ISLE_HALF = 0.525;
const MAX_PLANKS = 16;
const MIN_RADIUS = 1.7;
const MAX_RADIUS = 2.6;
const EDGE_GAP = 8;
const ISLE_REACH = 0.76;
const STAGGER = 45;
const SKIN_TONES = [
  "#f7d7c0",
  "#eebd98",
  "#d69c6f",
  "#b0774b",
  "#85532f",
  "#5c371d",
];
const WALKER_REACH_MOUSE = 8;
const WALKER_REACH_TOUCH = 14;
const SKIN_OUTLINE = "rgb(0 0 0 / 0.38)";
const NAMES = [
  "Ola",
  "Jonas",
  "Marta",
  "Priya",
  "Tomás",
  "Kenji",
  "Aleksandra Wiśniewska-Kowalczyk",
  "Noor",
  "Emre",
  "Lena",
];

const WIDEST = Math.max(
  ...Object.values(ANGLE).map(angle =>
    Math.abs(Math.cos((angle * Math.PI) / 180)),
  ),
);

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const backOut = (p: number) => {
  const c1 = 1.25;
  const q = p - 1;

  return 1 + (c1 + 1) * q * q * q + c1 * q * q;
};

const need = <T>(value: null | T, name: string): T => {
  if (value === null) throw new Error(`Islands scene is missing ${name}`);

  return value;
};

const toRgb = (value: string, fallback: string, alpha = 1) => {
  const probe = document.createElement("canvas");

  probe.width = 1;
  probe.height = 1;

  const pen = probe.getContext("2d", { willReadFrequently: true });

  if (!pen) return fallback;

  pen.fillStyle = fallback;
  pen.fillStyle = value;
  pen.fillRect(0, 0, 1, 1);

  const [r, g, b] = pen.getImageData(0, 0, 1, 1).data;

  return `rgb(${r} ${g} ${b} / ${alpha})`;
};

export const startIslands = (
  root: HTMLElement,
  copy: IslandsCopy,
  { skipIntro }: { skipIntro: boolean },
) => {
  const ctx = createRuntime();
  const reduced = ctx.reduced;
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
    need(root.querySelector<T>(selector), selector);

  const scene = $(".mk-isles-scene");
  const iso = $(".mk-isles-iso");
  const plankLayer = $(".mk-isles-planks");
  const canvas = $<HTMLCanvasElement>(".mk-isles-walk");
  const pen = need(canvas.getContext("2d"), "canvas context");
  const allBtn = $(".mk-isles-all");
  const allLabel = $(".mk-isles-all-label");
  const captionTitle = $(".mk-isles-caption-title");
  const captionText = $(".mk-isles-caption-text");
  const homeEl = $(".mk-isles-island-home");
  const homeChip = $(".mk-isles-chip-home");
  const homeIsle = need(
    homeEl.querySelector<HTMLElement>(".mk-isles-isle"),
    "home isle",
  );

  let unit = 80;
  let originX = 300;
  let originY = 200;
  let radius = 2.15;
  let dense = true;
  let now = 0;
  let amber = "rgb(230 150 40 / 1)";
  let blue = "rgb(50 100 200 / 1)";
  let rope = "rgb(40 40 50 / 0.45)";
  let dirty = true;

  const mark = () => {
    dirty = true;
  };

  const home = {
    bob: Math.random() * 6,
    dip: ctx.spring(0, { damping: 8, onUpdate: mark, stiffness: 160 }),
    z: 0,
  };
  const isles = {} as Record<IslandPart, Isle>;

  for (const part of ISLAND_PARTS) {
    const el = $(`.mk-isles-island[data-part="${part}"]`);
    const isle: Isle = {
      angle: 0,
      ax: 0,
      ay: 0,
      back: false,
      bob: Math.random() * 6,
      bx: 0,
      by: 0,
      chain: {
        l: new Float32Array(MAX_PLANKS),
        lv: new Float32Array(MAX_PLANKS),
        v: new Float32Array(MAX_PLANKS),
        vv: new Float32Array(MAX_PLANKS),
      },
      chip: $(`.mk-isles-chip[data-part="${part}"]`),
      dip: ctx.spring(0, { damping: 8, onUpdate: mark, stiffness: 160 }),
      el,
      flag: need(el.querySelector<HTMLElement>(".mk-isles-flag"), "flag"),
      key: $(`.mk-isles-key[data-part="${part}"]`),
      n: 8,
      open: false,
      planks: [],
      ring: need(el.querySelector<HTMLElement>(".mk-isles-ring"), "ring"),
      rise: null,
      spot: $(`.mk-isles-spot[data-part="${part}"]`),
      ux: 1,
      uy: 0,
      x: 0,
      y: 0,
      z: 0,
    };

    for (const door of el.querySelectorAll(".mk-isles-door")) {
      const panel = document.createElement("i");

      panel.className = "mk-isles-door-panel";
      door.append(panel);
    }

    for (let k = 0; k < MAX_PLANKS; k += 1) {
      const plank = document.createElement("i");

      plank.className = "mk-isles-plank";
      plank.dataset.part = part;
      plank.dataset.k = String(k);
      plankLayer.append(plank);
      isle.planks.push({
        el: plank,
        gone: -1,
        shown: 0,
        t0: Infinity,
        x: 0,
        y: 0,
        z: 0,
      });
    }

    isles[part] = isle;
  }

  ctx.onCleanup(() => {
    plankLayer.replaceChildren();
    for (const panel of root.querySelectorAll(".mk-isles-door-panel"))
      panel.remove();
  });

  const layout = () => {
    for (const part of ISLAND_PARTS) {
      const isle = isles[part];
      const phi = ((ANGLE[part] + 45) * Math.PI) / 180;

      isle.x = Math.cos(phi) * radius;
      isle.y = Math.sin(phi) * radius;
      isle.back = CHIP_ABOVE_ROOF.includes(part);

      const length = Math.hypot(isle.x, isle.y);
      const ux = isle.x / length;
      const uy = isle.y / length;

      isle.ux = ux;
      isle.uy = uy;
      isle.ax = ux * (HOME_HALF - 0.04);
      isle.ay = uy * (HOME_HALF - 0.04);
      isle.bx = isle.x - ux * (ISLE_HALF - 0.04);
      isle.by = isle.y - uy * (ISLE_HALF - 0.04);
      isle.n = Math.round(
        clamp(
          Math.hypot(isle.bx - isle.ax, isle.by - isle.ay) / 0.095,
          8,
          MAX_PLANKS,
        ),
      );
      isle.angle = (Math.atan2(uy, ux) * 180) / Math.PI + 90;
      isle.spot.style.transform = `translate3d(${(isle.x * unit).toFixed(1)}px,${(isle.y * unit).toFixed(1)}px,0)`;
      isle.planks.forEach((plank, k) => {
        plank.el.hidden = k >= isle.n;
      });
    }
  };

  const COS_YAW = Math.cos((-45 * Math.PI) / 180);
  const SIN_YAW = Math.sin((-45 * Math.PI) / 180);
  const COS_RX = Math.cos((58 * Math.PI) / 180);
  const SIN_RX = Math.sin((58 * Math.PI) / 180);
  const sx = (x: number, y: number) =>
    originX + (x * COS_YAW - y * SIN_YAW) * unit;
  const sy = (x: number, y: number, z: number) =>
    originY + ((x * SIN_YAW + y * COS_YAW) * COS_RX - z * SIN_RX) * unit;

  const SAG = 0.06;
  let bridgeZ = 0;
  let bridgeL = 0;

  const sampleBridge = (isle: Isle, t: number) => {
    const kf = clamp(t * isle.n - 0.5, 0, isle.n - 1);
    const k0 = Math.floor(kf);
    const k1 = Math.min(isle.n - 1, k0 + 1);
    const f = kf - k0;
    const { l, v } = isle.chain;
    const v0 = v[k0];
    const l0 = l[k0];

    bridgeZ =
      home.z +
      (isle.z - home.z) * t -
      SAG * Math.sin(Math.PI * t) +
      v0 +
      (v[k1] - v0) * f;
    bridgeL = l0 + (l[k1] - l0) * f;
  };

  const MAX = 60;
  const wPart = new Int8Array(MAX).fill(-1);
  const wPhase = new Float32Array(MAX);
  const wSpeed = new Float32Array(MAX);
  const wHomeX = new Float32Array(MAX);
  const wHomeY = new Float32Array(MAX);
  const wSide = new Float32Array(MAX);
  const wHop = new Float32Array(MAX);
  const wName = new Uint8Array(MAX);
  const wX = new Float32Array(MAX).fill(-999);
  const wY = new Float32Array(MAX).fill(-999);
  let seed = 5;

  const random = () => {
    seed = (seed * 16807) % 2147483647;

    return seed / 2147483647;
  };

  const addWalker = (index: number, phase: number) => {
    for (let i = 0; i < MAX; i += 1) {
      if (wPart[i] !== -1) continue;

      wPart[i] = index;
      wPhase[i] = phase;
      wSpeed[i] = 0.75 + random() * 0.5;
      wHomeX[i] = (random() - 0.5) * 0.8;
      wHomeY[i] = (random() - 0.5) * 0.8;
      wSide[i] = (random() - 0.5) * 0.14;
      wHop[i] = 0;
      wName[i] = Math.floor(random() * NAMES.length);

      return i;
    }

    return -1;
  };

  const send = (part: IslandPart) => {
    const index = ISLAND_PARTS.indexOf(part);

    for (let n = 0; n < (dense ? 6 : 3); n += 1) {
      addWalker(index, reduced ? 0.08 + random() * 0.84 : random());
    }

    mark();
  };

  const recall = (part: IslandPart) => {
    const index = ISLAND_PARTS.indexOf(part);

    for (let i = 0; i < MAX; i += 1) {
      if (wPart[i] === index) {
        wPart[i] = -1;
        wX[i] = -999;
      }
    }

    mark();
  };

  let pX = 0;
  let pY = 0;
  let pZ = 0;

  const walkerAt = (i: number) => {
    const isle = isles[ISLAND_PARTS[wPart[i]]];
    const phase = wPhase[i];
    const s = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
    const px = -isle.uy;
    const py = isle.ux;
    const homeX = wHomeX[i];
    const homeY = wHomeY[i];

    if (s < 0.2) {
      const k = s / 0.2;

      pX = homeX + (isle.ax - homeX) * k;
      pY = homeY + (isle.ay - homeY) * k;
      pZ = home.z;
    } else if (s < 0.8) {
      const t = (s - 0.2) / 0.6;
      const side = wSide[i];

      sampleBridge(isle, t);
      pX = isle.ax + (isle.bx - isle.ax) * t + px * (side + bridgeL);
      pY = isle.ay + (isle.by - isle.ay) * t + py * (side + bridgeL);
      pZ = bridgeZ;
    } else {
      const k = (s - 0.8) / 0.2;
      const dx = isle.x - 0.12;
      const dy = isle.y + 0.22;

      pX = isle.bx + (dx - isle.bx) * k;
      pY = isle.by + (dy - isle.by) * k;
      pZ = isle.z;
    }
  };

  const FLOCK = 12;
  const fStart = new Float32Array(FLOCK).fill(-1);
  const fTo = new Int8Array(FLOCK).fill(-1);
  const fOffX = new Float32Array(FLOCK);
  const fOffY = new Float32Array(FLOCK);
  const SPARKS = 12;
  const sparkX = new Float32Array(SPARKS);
  const sparkY = new Float32Array(SPARKS);
  const sparkAge = new Float32Array(SPARKS).fill(1);
  let sparkNext = 0;

  const spark = (x: number, y: number) => {
    sparkX[sparkNext] = x;
    sparkY[sparkNext] = y;
    sparkAge[sparkNext] = 0;
    sparkNext = (sparkNext + 1) % SPARKS;
  };

  const simulate = (chain: Chain, n: number, dt: number) => {
    const { l, lv, v, vv } = chain;
    let energy = 0;

    for (let step = 0; step < 4; step += 1) {
      const h = dt / 4;

      for (let k = 0; k < n; k += 1) {
        const prev = k > 0 ? v[k - 1] : 0;
        const next = k < n - 1 ? v[k + 1] : 0;
        const here = v[k];

        vv[k] += (-60 * here + 700 * (prev + next - 2 * here) - 5 * vv[k]) * h;

        const prevL = k > 0 ? l[k - 1] : 0;
        const nextL = k < n - 1 ? l[k + 1] : 0;
        const hereL = l[k];

        lv[k] +=
          (-16 * hereL + 260 * (prevL + nextL - 2 * hereL) - 2.2 * lv[k]) * h;
      }

      for (let k = 0; k < n; k += 1) {
        v[k] += vv[k] * h;
        l[k] += lv[k] * h;
      }
    }

    for (let k = 0; k < n; k += 1) {
      energy +=
        Math.abs(v[k]) + Math.abs(vv[k]) + Math.abs(l[k]) + Math.abs(lv[k]);
    }

    if (energy < 0.0005) {
      v.fill(0);
      vv.fill(0);
      l.fill(0);
      lv.fill(0);
    }
  };

  let ratio = 1;
  let width = 0;
  let height = 0;

  const drawRopes = () => {
    pen.strokeStyle = rope;
    pen.lineWidth = dense ? 1.25 : 1;
    pen.beginPath();

    for (const part of ISLAND_PARTS) {
      const isle = isles[part];
      let last = -1;

      for (let k = 0; k < isle.n; k += 1) {
        if (isle.planks[k].shown >= 0.6) last = k;
        else break;
      }

      if (last < 0) continue;

      const px = -isle.uy;
      const py = isle.ux;

      for (const side of [-1, 1]) {
        const ox = px * side * 0.15;
        const oy = py * side * 0.15;

        pen.moveTo(
          sx(isle.ax + ox, isle.ay + oy),
          sy(isle.ax + ox, isle.ay + oy, home.z + 0.14),
        );

        for (let k = 0; k <= last; k += 1) {
          const plank = isle.planks[k];

          pen.lineTo(
            sx(plank.x + ox, plank.y + oy),
            sy(plank.x + ox, plank.y + oy, plank.z + 0.12),
          );
        }

        if (last === isle.n - 1) {
          pen.lineTo(
            sx(isle.bx + ox, isle.by + oy),
            sy(isle.bx + ox, isle.by + oy, isle.z + 0.14),
          );
        }

        pen.moveTo(
          sx(isle.ax + ox, isle.ay + oy),
          sy(isle.ax + ox, isle.ay + oy, home.z + 0.16),
        );
        pen.lineTo(
          sx(isle.ax + ox, isle.ay + oy),
          sy(isle.ax + ox, isle.ay + oy, home.z),
        );
      }
    }

    pen.stroke();
  };

  const drawWalkers = (delta: number) => {
    const step = delta / 6400;
    const r = dense ? 2.8 : 2.3;

    pen.strokeStyle = SKIN_OUTLINE;
    pen.lineWidth = 0.75;

    for (let i = 0; i < MAX; i += 1) {
      const index = wPart[i];

      if (index === -1) continue;

      const part = ISLAND_PARTS[index];
      const isle = isles[part];
      const before = wPhase[i];
      let phase = before + step * wSpeed[i];

      if (before < 0.5 && phase >= 0.5 && !reduced) {
        spark(sx(isle.x, isle.y), sy(isle.x, isle.y, isle.z + ROOF[part]) - 8);
      }

      if (phase >= 1) phase -= 1;
      wPhase[i] = phase;

      const hop = Math.max(0, wHop[i] - delta / 460);

      wHop[i] = hop;
      walkerAt(i);

      const x = sx(pX, pY);
      const y = sy(pX, pY, pZ) - (hop > 0 ? Math.sin(hop * Math.PI) * 9 : 0);

      wX[i] = x;
      wY[i] = y;
      pen.fillStyle = SKIN_TONES[i % SKIN_TONES.length];
      pen.beginPath();
      pen.arc(x, y, r * (1 + hop * 0.4), 0, Math.PI * 2);
      pen.fill();
      pen.stroke();
    }
  };

  const drawFlocks = () => {
    pen.fillStyle = blue;
    pen.beginPath();

    for (let b = 0; b < FLOCK; b += 1) {
      const start = fStart[b];

      if (start < 0 || now < start) continue;

      const isle = isles[ISLAND_PARTS[fTo[b]]];
      const t = clamp((now - start) / 950);

      if (t >= 1) {
        fStart[b] = -1;
        spark(sx(isle.x, isle.y), sy(isle.x, isle.y, isle.z) - 4);
        continue;
      }

      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const x0 = fOffX[b];
      const y0 = fOffY[b];
      const x1 = isle.x + x0 * 0.4;
      const y1 = isle.y + y0 * 0.4;
      const x = x0 + (x1 - x0) * e;
      const y = y0 + (y1 - y0) * e;
      const z = home.z + (isle.z - home.z) * e + Math.sin(Math.PI * t) * 1.2;
      const X = sx(x, y);
      const Y = sy(x, y, z);

      pen.moveTo(X + 2.6, Y);
      pen.arc(X, Y, 2.6, 0, Math.PI * 2);
    }

    pen.fill();
  };

  const drawSparks = (delta: number) => {
    pen.fillStyle = amber;

    for (let i = 0; i < SPARKS; i += 1) {
      const before = sparkAge[i];

      if (before >= 1) continue;

      const age = Math.min(1, before + delta / 900);
      const size = 3.2 * (1 - age * 0.4);
      const x = sparkX[i];
      const y = sparkY[i] - age * 16;

      sparkAge[i] = age;
      pen.globalAlpha = age < 0.2 ? age * 5 : 1 - (age - 0.2) / 0.8;
      pen.beginPath();
      pen.moveTo(x, y - size);
      pen.lineTo(x + size * 0.45, y - size * 0.45);
      pen.lineTo(x + size, y);
      pen.lineTo(x + size * 0.45, y + size * 0.45);
      pen.lineTo(x, y + size);
      pen.lineTo(x - size * 0.45, y + size * 0.45);
      pen.lineTo(x - size, y);
      pen.lineTo(x - size * 0.45, y - size * 0.45);
      pen.closePath();
      pen.fill();
    }

    pen.globalAlpha = 1;
  };

  const draw = (delta: number) => {
    pen.setTransform(ratio, 0, 0, ratio, 0, 0);
    pen.clearRect(0, 0, width, height);
    drawRopes();
    drawWalkers(delta);
    drawFlocks();
    drawSparks(delta);
  };

  const clouds = [...root.querySelectorAll<HTMLElement>(".mk-isles-cloud")].map(
    (el, index) => ({
      away: ctx.spring(0, { damping: 18, onUpdate: mark, stiffness: 40 }),
      el,
      index,
      puff: ctx.spring(0, { damping: 9, onUpdate: mark, stiffness: 260 }),
    }),
  );

  const chipAt = (el: HTMLElement, x: number, y: number) => {
    el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
  };

  const framePlanks = (isle: Isle) => {
    const px = -isle.uy;
    const py = isle.ux;

    for (let k = 0; k < isle.n; k += 1) {
      const plank = isle.planks[k];

      let appear = 0;
      let drop = 0;

      if (plank.t0 !== Infinity) {
        const p = reduced ? 1 : clamp((now - plank.t0) / 260);

        appear = clamp(p * 2.5);
        drop = (1 - backOut(p)) * 0.45;
      }

      if (plank.gone >= 0) {
        const q = reduced ? 1 : clamp((now - plank.gone) / 180);

        appear *= 1 - q;
        drop -= q * q * 0.7;

        if (q >= 1) {
          plank.gone = -1;
          plank.t0 = Infinity;
          appear = 0;
        }
      }

      const t = (k + 0.5) / isle.n;

      plank.shown = plank.gone >= 0 ? 0 : appear;
      sampleBridge(isle, t);
      plank.x = isle.ax + (isle.bx - isle.ax) * t + px * bridgeL;
      plank.y = isle.ay + (isle.by - isle.ay) * t + py * bridgeL;
      plank.z = bridgeZ + drop;
      plank.el.style.opacity = appear.toFixed(3);

      if (appear > 0 || plank.el.style.transform === "") {
        plank.el.style.transform = `translate3d(${(plank.x * unit).toFixed(1)}px,${(plank.y * unit).toFixed(1)}px,${(plank.z * unit).toFixed(2)}px) rotateZ(${isle.angle.toFixed(1)}deg)`;
      }
    }
  };

  const frameAll = (delta: number) => {
    const bob = reduced ? 0 : 0.045;

    home.z = Math.sin(now * 0.0012 + home.bob) * bob + home.dip.value;
    homeEl.style.transform = `translate3d(0,0,${(home.z * unit).toFixed(2)}px)`;
    chipAt(homeChip, sx(0, 0) - originX, sy(0, 0, home.z) - originY);

    for (const part of ISLAND_PARTS) {
      const isle = isles[part];
      const risen = isle.rise ? isle.rise.value : 0;
      const shown = risen > 0.01;

      isle.z =
        Math.sin(now * 0.0012 + isle.bob) * bob +
        isle.dip.value +
        (risen - 1) * 2.4;
      isle.el.toggleAttribute("data-shown", shown);

      if (shown) {
        isle.el.style.transform = `translate3d(${(isle.x * unit).toFixed(1)}px,${(isle.y * unit).toFixed(1)}px,${(isle.z * unit).toFixed(2)}px)`;
        isle.el.style.setProperty(
          "--mk-isles-fade",
          clamp(risen * 1.8).toFixed(3),
        );
      }

      if (!reduced && delta > 0)
        simulate(isle.chain, isle.n, Math.min(delta, 50) / 1000);

      framePlanks(isle);

      const lift = clamp(risen);
      const restX = sx(isle.x, isle.y) - originX;
      const restY = sy(isle.x, isle.y, 0) - originY;
      let upX = restX;
      let upY = sy(isle.x, isle.y, isle.z + ROOF[part] + 0.1) - originY - 14;

      if (!isle.back) {
        upX = sx(isle.x - ISLE_HALF, isle.y + ISLE_HALF) - originX;
        upY = sy(isle.x - ISLE_HALF, isle.y + ISLE_HALF, isle.z) - originY + 16;
      }

      chipAt(
        isle.chip,
        restX + (upX - restX) * lift,
        restY + (upY - restY) * lift,
      );
    }

    for (const cloud of clouds) {
      const drift = reduced
        ? 0
        : Math.sin(now * 0.00011 + cloud.index * 2.1) * 18;

      cloud.el.style.transform = `translate3d(${(drift + cloud.away.value).toFixed(1)}px,0,0) scale(${(1 + cloud.puff.value).toFixed(3)})`;
    }

    draw(delta);
  };

  const readColours = () => {
    const style = getComputedStyle(root);
    const token = (name: string) => style.getPropertyValue(name).trim();

    amber = toRgb(token("--mk-isles-amber"), amber);
    blue = toRgb(token("--primary"), blue);
    rope = toRgb(token("--foreground"), rope, 0.45);
    mark();
  };

  const measure = () => {
    const rect = scene.getBoundingClientRect();
    const spotBox = isles.forum.spot.firstElementChild;

    width = rect.width;
    height = rect.height;
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    unit = spotBox instanceof HTMLElement ? spotBox.offsetWidth / 1.05 : unit;
    originX = iso.offsetLeft;
    originY = iso.offsetTop;
    dense = width >= 560;
    radius = clamp(
      ((width / 2 - EDGE_GAP) / unit - ISLE_REACH) / WIDEST,
      MIN_RADIUS,
      MAX_RADIUS,
    );
    layout();
    mark();
  };

  const resizeObserver = new ResizeObserver(measure);

  resizeObserver.observe(scene);
  ctx.onCleanup(() => {
    resizeObserver.disconnect();
  });

  const themeWatch = new MutationObserver(readColours);

  themeWatch.observe(document.documentElement, {
    attributeFilter: ["class", "data-theme"],
    attributes: true,
  });
  ctx.onCleanup(() => {
    themeWatch.disconnect();
  });

  const fire = (el: HTMLElement, attr: string, ms: number) => {
    el.removeAttribute(attr);
    void el.offsetWidth;
    el.setAttribute(attr, "");
    ctx.timeout(() => {
      el.removeAttribute(attr);
    }, ms);
  };

  const say = (title: string, text: string) => {
    captionTitle.textContent = title;
    captionText.textContent = text;
  };

  const openParts = () => ISLAND_PARTS.filter(part => isles[part].open);

  const setAll = (full: boolean) => {
    allBtn.setAttribute("aria-pressed", String(full));
    allLabel.textContent = full ? copy.all.on : copy.all.off;
  };

  const sync = () => {
    const count = openParts().length;

    for (const part of ISLAND_PARTS) {
      isles[part].key.setAttribute("aria-pressed", String(isles[part].open));
    }

    setAll(count === ISLAND_PARTS.length);
  };

  const raise = (part: IslandPart, quiet = false, instant = false) => {
    const isle = isles[part];

    if (isle.open) return;

    isle.open = true;

    const snap = reduced || instant;
    const from = isle.rise ? isle.rise.value : 0;

    isle.rise?.jump(from);
    isle.rise = ctx.spring(from, {
      damping: 13,
      onUpdate: mark,
      precision: 0.002,
      stiffness: 150,
    });
    if (snap) isle.rise.jump(1);
    else isle.rise.set(1);
    isle.el.setAttribute("data-up", "");
    isle.spot.setAttribute("data-hidden", "");
    isle.chip.setAttribute("data-up", "");
    if (!snap) ctx.timeout(() => fire(isle.ring, "data-fire", 700), 420);

    const start = now + (snap ? 0 : 380);

    isle.planks.forEach((plank, k) => {
      plank.gone = -1;
      plank.t0 = snap ? -1e6 : start + k * STAGGER;
    });
    ctx.timeout(
      () => {
        if (isle.open) send(part);
      },
      snap ? 0 : 380 + isle.n * STAGGER + 260,
    );
    if (!quiet) say(copy.names[part], copy.captions[part]);
    mark();
    sync();
  };

  const lower = (part: IslandPart, quiet = false) => {
    const isle = isles[part];

    if (!isle.open) return;

    isle.open = false;

    const from = isle.rise ? isle.rise.value : 1;

    isle.rise?.jump(from);
    isle.rise = ctx.spring(from, {
      damping: 30,
      onUpdate: mark,
      precision: 0.002,
      stiffness: 320,
    });
    isle.rise.set(0);
    isle.el.removeAttribute("data-up");
    isle.spot.removeAttribute("data-hidden");
    isle.chip.removeAttribute("data-up");
    isle.planks.forEach((plank, k) => {
      if (plank.t0 !== Infinity) plank.gone = now + (isle.n - 1 - k) * 15;
    });
    recall(part);
    if (!quiet) say(copy.names[part], copy.lowered);
    mark();
    sync();
  };

  let timers: number[] = [];

  const cancelWave = () => {
    for (const timer of timers) window.clearTimeout(timer);
    timers = [];
  };

  ctx.onCleanup(cancelWave);

  const later = (fn: () => void, ms: number) => {
    timers.push(window.setTimeout(fn, ms));
  };

  const connectAll = () => {
    cancelWave();
    WAVE.filter(part => !isles[part].open).forEach((part, index) => {
      if (reduced) raise(part, true);
      else later(() => raise(part, true), index * 160);
    });
    setAll(true);
    say(copy.home, copy.captions.people);
  };

  const cutAll = () => {
    cancelWave();
    WAVE.filter(part => isles[part].open && !REST.includes(part))
      .reverse()
      .forEach((part, index) => {
        if (reduced) lower(part, true);
        else later(() => lower(part, true), index * 60);
      });
    for (const part of REST) raise(part, true);
    setAll(false);
    say(copy.home, copy.cut);
  };

  let nudges = 0;
  let nudgeTimer = 0;

  const touch = () => {
    root.setAttribute("data-touched", "");
    window.clearTimeout(nudgeTimer);
  };

  const nudge = () => {
    if (root.hasAttribute("data-touched") || nudges >= 2 || reduced) return;

    nudges += 1;
    if (nudges === 1) fire(isles.forum.flag, "data-wave", 900);
    else home.dip.fling(0, -1.2);
    nudgeTimer = window.setTimeout(nudge, 5000);
  };

  nudgeTimer = window.setTimeout(nudge, 4200);
  ctx.onCleanup(() => {
    window.clearTimeout(nudgeTimer);
  });

  const ripple = (isle: Isle, k: number, vertical: number, lateral: number) => {
    if (reduced) return;

    isle.chain.vv[k] += vertical;
    isle.chain.lv[k] += lateral;
    mark();
  };

  const listen = <K extends keyof HTMLElementEventMap>(
    el: HTMLElement,
    type: K,
    fn: (event: HTMLElementEventMap[K]) => void,
    capture = false,
  ) => {
    el.addEventListener(type, fn, capture);
    ctx.onCleanup(() => {
      el.removeEventListener(type, fn, capture);
    });
  };

  const toggle = (part: IslandPart) => {
    cancelWave();
    touch();
    if (isles[part].open) lower(part);
    else raise(part);
  };

  for (const part of ISLAND_PARTS) {
    const isle = isles[part];
    const isleEl = need(
      isle.el.querySelector<HTMLElement>(".mk-isles-isle"),
      "isle",
    );
    const spotBox = isle.spot.firstElementChild;

    if (spotBox instanceof HTMLElement) {
      listen(spotBox, "click", () => {
        cancelWave();
        touch();
        raise(part);
      });
    }

    listen(isleEl, "pointerdown", () => {
      if (isle.open) isle.dip.set(-0.06);
    });
    listen(isleEl, "pointerleave", () => {
      isle.dip.set(0);
    });
    listen(isleEl, "pointercancel", () => {
      isle.dip.set(0);
    });
    listen(isleEl, "click", () => {
      toggle(part);
    });

    listen(isle.key, "click", () => {
      toggle(part);
    });
  }

  listen(plankLayer, "click", event => {
    const plankEl =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>(".mk-isles-plank")
        : null;
    const part = ISLAND_PARTS.find(name => name === plankEl?.dataset.part);

    if (!plankEl || !part) return;

    touch();

    const isle = isles[part];
    const index = ISLAND_PARTS.indexOf(part);

    ripple(isle, Number(plankEl.dataset.k), -2.8, 1.6);

    for (let i = 0; i < MAX; i += 1) {
      if (wPart[i] !== index) continue;

      const phase = wPhase[i];
      const s = phase < 0.5 ? phase * 2 : (1 - phase) * 2;

      if (s > 0.2 && s < 0.8) wHop[i] = 1;
    }

    say(copy.bridge(copy.names[part]), copy.react.plank);
  });

  listen(homeIsle, "pointerdown", () => {
    home.dip.set(-0.05);
  });
  listen(homeIsle, "pointerleave", () => {
    home.dip.set(0);
  });
  listen(homeIsle, "click", () => {
    touch();
    home.dip.fling(0, -1);

    const targets = openParts();

    if (targets.length === 0) {
      say(copy.home, copy.captions.people);

      return;
    }

    const target = targets[Math.floor(random() * targets.length)];

    if (!reduced) {
      let launched = 0;

      for (let b = 0; b < FLOCK && launched < 7; b += 1) {
        if (fStart[b] >= 0) continue;

        fStart[b] = now + launched * 45;
        fTo[b] = ISLAND_PARTS.indexOf(target);
        fOffX[b] = (random() - 0.5) * 0.9;
        fOffY[b] = (random() - 0.5) * 0.9;
        launched += 1;
      }

      ctx.timeout(() => fire(isles[target].ring, "data-fire", 700), 950);
    }

    say(copy.home, copy.react.flock);
    mark();
  });

  for (const cloud of clouds) {
    listen(cloud.el, "click", () => {
      touch();
      if (!reduced) {
        cloud.puff.fling(0, 1.6);
        cloud.away.set((cloud.index === 0 ? -1 : 1) * 200);
        ctx.timeout(() => {
          cloud.away.set(0);
        }, 1800);
      }

      say(copy.clearSkies, copy.react.cloud);
    });
  }

  let walkerHit = -1;

  const nearestWalker = (event: PointerEvent) => {
    if (
      event.target instanceof Element &&
      event.target.closest(".mk-isles-plank")
    )
      return -1;

    const rect = scene.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const reach =
      event.pointerType === "touch" ? WALKER_REACH_TOUCH : WALKER_REACH_MOUSE;
    let best = -1;
    let bestDistance = reach * reach;

    for (let i = 0; i < MAX; i += 1) {
      if (wPart[i] === -1) continue;

      const distance = (wX[i] - x) ** 2 + (wY[i] - y) ** 2;

      if (distance < bestDistance) {
        best = i;
        bestDistance = distance;
      }
    }

    return best;
  };

  listen(
    scene,
    "pointerdown",
    event => {
      walkerHit = nearestWalker(event);
      if (walkerHit !== -1) event.stopPropagation();
    },
    true,
  );
  listen(
    scene,
    "click",
    event => {
      if (walkerHit === -1) return;

      event.stopPropagation();
      touch();
      wHop[walkerHit] = 1;
      say(NAMES[wName[walkerHit]], copy.react.walker);
      walkerHit = -1;
      mark();
    },
    true,
  );

  listen(allBtn, "click", () => {
    touch();
    if (allBtn.getAttribute("aria-pressed") === "true") cutAll();
    else connectAll();
  });

  measure();
  readColours();
  root.setAttribute("data-ready", "");
  ctx.onCleanup(() => {
    root.removeAttribute("data-ready");
    root.removeAttribute("data-touched");
  });

  ctx.loop(scene, (elapsed, delta) => {
    now = elapsed;
    if (reduced && !dirty) return;

    dirty = false;
    frameAll(reduced ? 0 : delta);
  });

  if (reduced || skipIntro) raise("forum", true, true);
  else ctx.timeout(() => raise("forum", true), 380);

  return ctx.dispose;
};
