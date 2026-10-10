---
name: vitnode-docs
description: >
  Write, update, and review VitNode MDX documentation whenever implementing or documenting VitNode features, APIs, plugins, or AdminCP workflows. Use for tutorials, how-to guides, reference pages, explanations, documentation cleanup, and real UI screenshots. Require concise, focused pages, splitting broad topics into linked MDX files when needed, plain language, working step-by-step examples, supported Fumadocs components, and screenshots rendered through apps/web/src/components/fumadocs/img.tsx.
---

# VitNode Docs

Write documentation that helps the reader complete one concrete task. Explain what to do, where to do it, why it matters, and how to check the result.

## 1. Inspect before writing

- Read applicable `AGENTS.md` / `CLAUDE.md` instructions and the implementation being documented.
- Locate the actual docs directory, navigation metadata, MDX configuration, and package scripts. Do not assume a directory from memory.
- Read two nearby documentation pages and the component registration used by the docs renderer.
- Read `apps/web/src/components/fumadocs/img.tsx` and its existing usages. Verify its export, props, image source handling, and MDX registration.
- Check available Fumadocs components and the installed version. Prefer existing project wrappers and conventions.
- Verify API names, imports, paths, defaults, permissions, and supported behavior against current source code. Treat source code as authoritative when existing docs disagree.
- Document implemented behavior. Label experimental behavior when supported by the project; do not present plans as available features.

## 2. Choose the page type

Choose one primary page type and one reader outcome. Plan the page boundaries before drafting; do not write an exhaustive page and shorten it only afterward.

| Type        | Purpose                                   | Structure                                                 |
| ----------- | ----------------------------------------- | --------------------------------------------------------- |
| Overview    | Choose a guide within a broad topic       | Purpose → choices → focused guides                        |
| Tutorial    | Learn by building a small working example | Goal → prerequisites → steps → working result             |
| How-to      | Complete a specific task                  | Outcome → requirements → steps → verify                   |
| Reference   | Look up exact behavior                    | Purpose → signature → options/defaults → example → errors |
| Explanation | Understand a design or tradeoff           | Problem → concrete example → how it works → tradeoffs     |

### Use the VitNode documentation schema

Follow this self-contained schema. Do not mention external documentation brands or ask the reader to consult a style reference. Base technical claims on current VitNode code.

#### Shared page structure

1. **Frontmatter:** provide a short, searchable `title` and a one-sentence `description`. Follow the local schema for optional fields. Let the renderer display the title; do not duplicate it as an H1 unless the project requires that.
2. **Opening:** write one or two sentences stating the outcome and when to use it. Do not add a general essay about the topic.
3. **Main content:** use the structure for the chosen page type below. Keep headings descriptive and paragraphs short.
4. **Related link:** add up to three specific links only when they offer a useful next action. Omit a generic conclusion or recap.

Use these structures in the stated order. Omit conditional sections when they add no value; do not fill empty sections just to satisfy a template.

| Page type   | Main content schema                                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| Overview    | Brief purpose → decision table or short list of choices → links to focused guides                                      |
| Tutorial    | Before you begin (if needed) → Build the example (ordered steps) → Check the result                                    |
| How-to      | Before you begin (if needed) → task-specific steps → Check the result                                                  |
| Reference   | Signature or API shape → parameters/options table → return value → minimal usage example → relevant errors/constraints |
| Explanation | Concrete problem → how it works → practical consequences/tradeoffs → related implementation guide                      |

#### Step schema

Use `Steps` / `Step` for genuine ordered actions, following the project's MDX registration. Each step contains:

1. An action heading: “Create the query”, “Add the loader”, or “Invalidate the list”.
2. One short instruction stating the file, location, or UI action.
3. One focused code block or useful screenshot when needed.
4. At most one short paragraph explaining non-obvious behavior or an intermediate result.

Keep the final verification in “Check the result” instead of repeating verification prose after every trivial step. Use ordinary headings and prose for concepts rather than inventing procedural steps.

#### Code and reference schema

- Give every code block a language and, for file edits, a supported file title.
- Keep title short.
- Show a complete minimal file when creating one; show a labeled excerpt when changing an existing file. State where an excerpt belongs and link to required setup.
- Exclude unrelated styling, route metadata, schemas, and error handling from focused excerpts. Preserve code required to reproduce the task safely and correctly.
- Explain a new concept once, next to its first use. Do not narrate obvious code line by line.
- For option tables, use `Name | Type | Required | Default | Description` when those columns apply. For method tables, use `Method | Returns | Behavior`. Verify every value against source code.
- Add a quick start only when it saves time; do not repeat its commands in the main steps.
- Keep optional internals, advanced alternatives, and full API tables on linked pages. Keep essential correctness constraints next to the relevant example.
- Use callouts only for easily missed constraints and cards only when they improve navigation. Do not add decorative sections or nested headings without a reader need.

### Keep pages focused and split broad topics

- Default to a short page that answers one question or completes one task. Cover the useful path first, not everything the implementation supports.
- Split into multiple `.mdx` files when sections solve independently useful tasks, require different prerequisites, or mix a substantial tutorial with an API reference or architecture explanation. Perform this split as part of the docs task unless the user requests one file.
- Use roughly 300–600 words of prose for a how-to and 500–900 for a tutorial as review signals, not quotas or hard limits. Exclude frontmatter, code, and reference tables. A short page needs no padding; a longer cohesive workflow may stay together.
- Review scope even below those ranges when there are two independent step sequences, more than four substantial code blocks, or repeated setup. Do not split merely by heading, line count, or an arbitrary length threshold.
- Keep the smallest complete workflow, its required prerequisites, correctness-critical caveats, and verification together. Never force readers to jump between pages to finish one short task.
- Move the full method/options table to a reference page. Move optional internals, alternatives, and advanced edge cases to an explanation or advanced guide. Link at the point where a reader may need them.
- For a broad topic, use a brief overview with a decision table and links to the focused guides. Do not repeat their steps, code, or reference tables on the overview.
- Reuse existing prerequisite and reference pages. Do not create near-duplicate pages or small pages that contain only one paragraph and a link.
- Preserve existing public URLs where possible. When splitting an existing page, keep its URL as the overview or use the repository's supported redirect mechanism. Update navigation, incoming links, and related pages; verify every new link resolves.

Example split for a page covering both app and API caching (adapt names and paths to the repository):

| Page                | Keep on this page                                                               |
| ------------------- | ------------------------------------------------------------------------------- |
| Cache overview      | Which layer to choose; links to the guides                                      |
| Cache app data      | Query options → loader/component integration → invalidation → verify            |
| Cache API data      | Redis prerequisite link → remember → delete after a write → verify              |
| Cache API reference | Method signatures, defaults, return values, serialization and fallback behavior |

Keep important user-isolation and invalidation requirements beside the relevant example. Move unrelated Content Engine behavior to its existing guide rather than expanding the cache overview.

## 3. Write in plain language

- Use the language of the surrounding docs, normally English, unless the user requests another language.
- Prefer short sentences, active voice, familiar words, and direct instructions: “Create”, “Add”, “Open”, “Run”.
- Start with one or two sentences explaining the outcome and when the feature is useful.
- Explain an unfamiliar term on first use. Describe what an abstraction does before explaining its internals.
- Use concrete examples, preferably one consistent plugin or feature throughout the page.
- Avoid marketing language, filler, unexplained acronyms, and repeated introductory paragraphs.
- Put the smallest working example first. Introduce advanced options after the reader can verify the basic result.
- Keep UI instructions aligned with current labels and locations. Use paths such as **AdminCP → …** only after verifying them.
- Explain important reasons beside the relevant action. Keep implementation detail only when it helps the reader act or understand behavior.
- Say each fact once. Do not repeat the same point in the introduction, step text, callout, table, and conclusion.
- Default to one short paragraph of instruction per step and, only if needed, one short explanation after the code. Do not narrate obvious code line by line.
- Remove sentences that do not help the reader choose, act, understand a non-obvious constraint, or verify the result. Link to deeper explanations instead of adding them to the main path.
- Keep prerequisites to missing requirements, not a general setup tutorial. Prefer one relevant next-step link over a generic closing section.

### Edit for a natural technical voice

- Prefer concrete verbs and consequences over promotional adjectives. Replace "utilize" with "use" and "significantly improves performance" with the measured change or actual behavior.
- Remove filler such as "it is important to note", "in order to", and "not just X, but Y". State the useful fact directly.
- Keep one consistent name for each concept. Do not alternate "component", "widget", and "control" for the same thing unless the implementation distinguishes them.
- Name the actor when it matters: "The loader fills the cache" rather than "The cache is filled". Keep necessary uncertainty, but avoid stacked hedges.
- Use sentence case headings, restrained bold, straight quotes in source prose, and no decorative emojis or em dashes. Preserve exact API names, UI labels, code, and quoted source text.
- Vary sentence length naturally without adding tangents, invented opinions, personal anecdotes, or first-person reactions. Technical docs should sound direct and helpful.
- Delete generic conclusions, unsupported performance/security claims, and chat phrases such as "Great question" or "I hope this helps".
- Before finishing, read each paragraph for meaning: does it provide a concrete instruction, verified behavior, reason, or result? Rewrite vague prose; keep useful technical detail.

### Write for search and AI readers

- Match each page to a concrete reader question or task. Use the natural topic/API name in the title, description, opening, and relevant headings without repetition or keyword stuffing. For a broad topic, map related questions to existing or planned guides and fill useful gaps without creating a page for every wording variant.
- Answer the page's main question in the first paragraph. State what the feature does and its scope before steps or deeper detail.
- Make each section understandable when retrieved alone: name the relevant feature, API, or layer instead of relying on "this", "it", or a previous section. Keep required prerequisites and limitations close to the claim or example. Do not repeat the whole introduction in every section.
- Use descriptive headings, stable anchors, meaningful internal link text, and real links to prerequisites and references. Preserve canonical URLs when splitting pages; avoid duplicate pages aimed at keyword variations.
- Include exact imports, configuration names, types, defaults, units, errors, and expected results where relevant. Separate app/API behavior, examples/defaults, and implemented/planned features explicitly.
- State version or runtime constraints when they materially change the instructions. Use real modification dates from project metadata rather than changing dates to imply freshness.
- Keep important explanations and constraints in selectable text. Screenshots supplement instructions; they must not be the only source of UI labels or outcomes.
- Support technical claims with implementation evidence, reproducible examples, or a relevant primary-source link. Add benchmark numbers, expert quotes, author attribution, or dates only when real and useful; do not add them as citation bait.
- Keep HTML and Markdown exports equivalent in meaning, including all labeled tab alternatives. Do not add hidden bot-only text, prompt instructions for agents, fabricated FAQs, unsupported superlatives, or repetitive summaries to attract citations.
- Use a short question-and-answer section only for distinct recurring questions that are not already answered. Do not append a generic FAQ to every page.
- For a requested SEO/AI-readiness audit or visibility review, read `references/seo-review.md`. Do not run a broad crawl, install audit tools, or require competitor research for every MDX edit.
- Read `references/docs-site.md` for canonical metadata, crawlability, sitemaps, structured data, and AI discovery when site-level work is in scope. Clear content and accessible delivery improve usability; do not promise rankings, indexing, or AI citations.

## 4. Build complete step-by-step examples

For tutorials and how-to guides:

1. State the expected result and only the prerequisites needed for this task.
2. Give each step an action heading, such as “Register the plugin”.
3. State which file to create or edit and where to run commands.
4. Show only the code needed for this step, with real APIs and consistent identifiers. State whether the reader is creating a file or changing an existing one.
5. Explain new parts briefly below the example.
6. State the observable result of the step when useful.
7. End with a command, route, or UI action that verifies the complete result.
8. Add troubleshooting only for realistic errors supported by the implementation.

Keep the complete workflow reproducible; not every code block needs to recreate the application. For a new file, include the imports and setup required to run it. For a targeted change, show a clearly labeled excerpt with its file path and placement, and link to the existing setup or complete example. Do not hide task-critical code behind `...`, assume undefined variables without explaining their source, or reproduce unrelated schemas, route metadata, styling, and error handling just to make an excerpt look standalone. Show a full baseline once, then show only the changes. Introduce dependencies before using them. Match repository package-manager conventions; for reader-facing commands, provide equivalent pnpm/npm/bun variants when supported. Do not invent script names or package-manager equivalence.

For reference pages, include exact types, required fields, defaults, return values, and relevant errors. Avoid forcing a step sequence onto a lookup page. Link to a tutorial instead.

## 5. Use Fumadocs components deliberately

Inspect the local MDX registry and existing pages before choosing imports or syntax. Do not assume components are globally registered or that upstream examples match the installed version.

- Use `Steps` / `Step` for ordered workflows, following local heading conventions.
- Use `Tabs` / `Tab` for equivalent alternatives, such as supported package managers. Keep required steps outside tabs.
- Use `Callout` only for an easily missed prerequisite, limitation, or behavior that changes the reader's next action. Keep ordinary explanations in prose. Aim for at most two callouts on a short guide; retain more only when necessary for correctness.
- Use `Cards` / `Card` for related guides or next steps when locally supported.
- Use supported file-tree components when a directory structure helps the reader place files.
- Use supported type tables or Markdown tables for options, types, defaults, and required fields.
- Use code-fence language labels, file titles, and focused line highlighting in the syntax supported by this project.
- Keep essential instructions visible. Reserve accordions for optional detail.
- Do not install or change component infrastructure just to decorate a documentation page unless the task authorizes that work.

Use components to clarify content. Do not wrap every paragraph in one.

### Make docs easy to copy and inspect

- Use the existing code-block renderer with a working, keyboard-accessible copy button for every code snippet. Verify copied code excludes line numbers and highlight annotations. Keep shell prompts and sample output separate from executable commands.
- Use the site's existing "Copy as Markdown" and raw Markdown routes when available. Export useful text, code, links, and image references rather than unresolved JSX or private data. Verify existing exports for changed pages.
- Show a concrete result for examples: UI screenshots for visual workflows, sample output or request/response for APIs and commands, and a small diagram only when it clarifies a relationship. Do not add a screenshot or diagram to every concept by default.
- Preserve essential instructions in text and rendered HTML. Do not hide required content behind hover, animation, or an interaction that prevents direct reading or copying.
- When editing docs-site infrastructure or reviewing missing copy/export capabilities, read `references/docs-site.md`. Routine MDX writing should use existing infrastructure and report missing capabilities; do not expand it into a site rebuild.

## 6. Capture real screenshots for UI workflows

Capture screenshots when documenting AdminCP, forms, settings, editors, or other visual workflows where an image helps identify controls or verify a result. Skip images that add nothing to an API or code-only page.

1. Inspect the repository's development and browser automation setup. Start the app using documented commands, or use an authorized demo environment that matches the documented version.
2. Use an available browser or screenshot tool, such as the project's Playwright setup. Follow that tool's access rules. Use existing authorized test accounts and fixtures; never guess credentials.
3. Navigate through the workflow being documented. Use harmless demo data and capture the actual state described in the text.
4. Wait for fonts, images, data, and animations to settle. Dismiss irrelevant overlays and remove pointer hover states when they obscure controls.
5. Use a consistent viewport, locale, theme, and zoom. Prefer a readable desktop capture; add a mobile capture only when mobile behavior matters.
6. Capture the relevant panel or region with enough navigation context to orient the reader. Add a second screenshot only if a distinct state needs explanation.
7. Inspect each saved image. Retake it if labels are unreadable, content is clipped, or the page shows loading/error states unrelated to the guide.
8. Avoid exposing personal data, tokens, cookies, private URLs, or real user records. Prefer preparing clean demo data before capture.
9. Save assets in the repository's existing documentation image location. Use descriptive kebab-case names and stable repository paths. Use PNG or WebP according to existing support; keep text sharp and file sizes reasonable.
10. Place the image beside the step it illustrates. Add useful alt text and a short caption when the state needs explanation. Keep the action and result in text as well.

Never generate, draw, or fabricate an application screenshot. Do not substitute a mockup or claim a screenshot was captured when it was not. If the app, credentials, or capture tools are unavailable, finish the text and report the missing capture and its precise prerequisite. Do not commit broken image references or placeholders as completed screenshots.

### Render through the VitNode image component

Use `apps/web/src/components/fumadocs/img.tsx` for every documentation screenshot.

- If the MDX renderer maps Markdown images to this component, use the existing Markdown image syntax after verifying that mapping.
- Otherwise import its actual exported component through the project's supported alias or relative path, and use its actual props.
- Follow existing source-path, sizing, caption, and theme conventions supported by that component.
- Do not guess a component name such as `Img`, invent props, use a raw HTML image, or substitute an unrelated image component.
- If the component or registration is missing, report the mismatch rather than silently bypassing the requirement.
- Preview the rendered docs and verify that the image loads through the intended component, with correct sizing and supported interactions.

## 7. Verify and finish

- Walk through the guide in order using its stated prerequisites. Verify commands and code against the implementation; run examples when the environment supports them.
- Run the relevant existing MDX, formatting, type, link, or docs-build checks. Inspect package scripts first and avoid unrelated test suites.
- Preview the changed page. Check headings, table of contents, steps, tabs, code blocks, images, and internal links. Check narrow-screen readability for changed visual content.
- Verify screenshot assets exist and each referenced source resolves. Update navigation metadata and related links when adding or moving pages.
- Run a brevity pass: remove repetition and unrelated boilerplate, check the page has one outcome, and split independent workflows or reference material when needed. Preserve required setup and correctness-critical detail; move useful optional detail to a linked page instead of deleting it.
- Report changed pages, captured screenshots, verification performed, and any unresolved limitation. Distinguish source inspection from checks actually executed.

## Completion checklist

- [ ] Explain one concrete outcome in simple language without repeated prose.
- [ ] Split independent workflows/reference material into linked MDX pages when needed; preserve URLs and navigation.
- [ ] Match current VitNode code, names, permissions, and UI labels.
- [ ] Use a clear title/description, direct answer, descriptive links, and sections understandable on their own without keyword stuffing.
- [ ] Provide complete examples with file paths and expected results.
- [ ] Use supported Fumadocs components and valid MDX syntax; check code copying and existing Markdown exports when relevant.
- [ ] Capture useful real UI screenshots and render them through `img.tsx`.
- [ ] Verify navigation, links, assets, and the rendered page.
- [ ] State any checks or screenshot captures that could not be completed.
