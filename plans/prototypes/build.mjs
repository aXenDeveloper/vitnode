// Assembles a prototype folder into one self-contained HTML file.
//   node plans/prototypes/build.mjs hero
//   node plans/prototypes/build.mjs hero --only 01,04 --out /tmp/x.html
// Writes <out>.html (full document, open it in a browser) and
// <out>.artifact.html (same page without the document skeleton).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [name, ...rest] = process.argv.slice(2);

if (!name) {
  console.error("Usage: node build.mjs <prototype> [--only 01,02] [--out file.html]");
  process.exit(1);
}

const flag = (key) => {
  const index = rest.indexOf(key);

  return index === -1 ? null : rest[index + 1];
};

const only = flag("--only")?.split(",") ?? null;
const out = resolve(flag("--out") ?? join(here, "out", `${name}.html`));
const dir = join(here, name);
const read = (file) => readFileSync(join(dir, file), "utf8");

const files = readdirSync(join(dir, "variants"));
const ids = [...new Set(files.map((file) => file.replace(/\.(html|css|js)$/, "")))]
  .filter((id) => /^\d\d-/.test(id))
  .filter((id) => !only || only.includes(id.slice(0, 2)))
  .sort();

const variants = ids.map((id) => {
  const html = read(`variants/${id}.html`);
  const meta = /<!--\s*name:\s*(.+?)\s*\|\s*axis:\s*(.+?)\s*-->/.exec(html);

  if (!meta) throw new Error(`${id}.html needs a "<!-- name: X | axis: Y -->" first line`);

  const has = (ext) => files.includes(`${id}.${ext}`);

  return {
    axis: meta[2],
    css: has("css") ? read(`variants/${id}.css`) : "",
    html: html.replace(meta[0], "").trim(),
    id: id.slice(0, 2),
    js: has("js") ? read(`variants/${id}.js`) : "",
    name: meta[1],
  };
});

const variantsJs = variants
  .map(
    (variant) =>
      `VARIANTS.push({id:${JSON.stringify(variant.id)},name:${JSON.stringify(variant.name)},axis:${JSON.stringify(variant.axis)},html:${JSON.stringify(variant.html)},mount:function(root,ctx){\n${variant.js}\n}});`,
  )
  .join("\n")
  .replaceAll("</script", "<\\/script");

const page = read("shell.html")
  .replace("/*BASE_CSS*/", () => read("base.css"))
  .replace("/*VARIANT_CSS*/", () => variants.map((variant) => variant.css).join("\n"))
  .replace("/*VARIANTS_JS*/", () => variantsJs)
  .replace("/*BASE_JS*/", () => read("base.js").replaceAll("</script", "<\\/script"));

const skeleton = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${skeleton}\n${page}\n</body></html>\n`);
writeFileSync(out.replace(/\.html$/, ".artifact.html"), page);
console.log(`${variants.length} variants -> ${out}`);
