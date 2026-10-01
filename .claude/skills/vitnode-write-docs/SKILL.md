---
name: vitnode-write-docs
description: >
  Write, rewrite, and review VitNode documentation. Use for How-to guides,
  Reference pages, and Explanation pages. Produces concise, example-first,
  developer-focused MDX documentation using Fumadocs components where useful.
---

# VitNode Documentation Writer

Write documentation that helps developers understand or complete a task
as quickly as possible.

VitNode documentation should be:

- concise
- practical
- easy to scan
- example-first
- technically precise
- written in simple English
- useful without reading every paragraph

A reader should usually understand the main solution from:

1. the title
2. the first paragraph
3. the first code example

Avoid documentation that reads like an article, marketing page, or AI-generated
explanation.

---

# 1. Choose the page type first

Before writing, classify the page as exactly one primary type:

- **How-to**
- **Reference**
- **Explanation**

Do not mix multiple documentation styles unless there is a strong reason.

If an existing page mixes them, separate the concerns mentally and keep the
primary page focused.

## How-to

Use when the reader wants to accomplish something.

Examples:

- Create a plugin
- Add a route
- Use the fetcher
- Register an AdminCP navigation item
- Add translations
- Create a widget
- Add Elasticsearch to a plugin

The reader already has a goal.

Answer:

> How do I do this?

Prefer working code over conceptual explanation.

---

## Reference

Use when the reader needs precise technical information.

Examples:

- `fetcher()` API
- plugin configuration
- lifecycle hooks
- widget options
- content field types
- API context
- event definitions

Answer:

> What options exist and what exactly do they do?

Reference pages should be predictable, structured, and complete.

Do not turn reference pages into tutorials.

---

## Explanation

Use when the reader needs to understand a concept or architectural decision.

Examples:

- How the plugin system works
- Server and client data fetching
- Content Engine architecture
- Widget zones
- Cache architecture
- Internationalization
- Permissions

Answer:

> How does this work and why is it designed this way?

Examples are still encouraged, but explanation comes before procedural steps.

---

# 2. Writing style

Use simple technical English.

Prefer:

> Plugins can register routes.

Avoid:

> VitNode provides developers with a powerful and highly flexible mechanism
> that allows plugins to register custom routes.

Prefer:

> Use `fetcher()` to call another plugin.

Avoid:

> In order to communicate with APIs exposed by other plugins, developers can
> make use of the powerful `fetcher()` utility provided by VitNode.

---

## Sentence rules

Use short sentences.

Prefer one idea per sentence.

Use active voice whenever possible.

Prefer:

> VitNode validates the configuration when the plugin loads.

Avoid:

> The configuration will be validated by VitNode when the plugin is loaded.

---

## Paragraph rules

Keep most paragraphs between 1 and 3 sentences.

Break long explanations into sections.

If a paragraph contains more than one independent concept, split it.

---

## Remove filler

Delete phrases such as:

- In this guide, we will...
- In this section...
- It is important to note that...
- Keep in mind that...
- As you can see...
- Basically...
- Simply...
- Obviously...
- This allows developers to...
- VitNode provides a powerful...
- VitNode offers a flexible...
- One of the key benefits...
- When it comes to...
- In order to...
- It should be noted...

Start with the useful information instead.

---

# 3. Example-first documentation

Prefer examples over long explanations.

When possible, show the smallest realistic example first.

Example:

```ts
const posts = await fetcher({
  plugin: blogPlugin,
  method: "GET",
  path: "/posts",
});
```

Then explain only the parts that are not obvious.

Do not explain basic TypeScript or JavaScript syntax.

Do explain:

- VitNode-specific behavior
- lifecycle behavior
- caching
- permissions
- server/client differences
- plugin boundaries
- unusual defaults
- important constraints

---

# 4. Examples must be realistic

Examples should look like code someone could actually use in a VitNode plugin.

Avoid:

```ts
const foo = doSomething();
```

Prefer domain examples:

```ts
const posts = await fetcher({
  plugin: blogPlugin,
  method: "GET",
  path: "/posts",
});
```

Use realistic names such as:

- `blogPlugin`
- `forumPlugin`
- `posts`
- `comments`
- `category`
- `user`
- `page`
- `widget`

Avoid meaningless names like:

- `foo`
- `bar`
- `test`
- `exampleThing`

unless the API itself requires them.

---

# 5. Keep examples small

Show only code relevant to the concept.

Aim for roughly 5–20 lines for most examples.

Do not include:

- unrelated imports
- boilerplate already explained elsewhere
- complete application files when a fragment is enough
- duplicated types
- unrelated error handling

If readers need the full file structure, use a Fumadocs `Files` component.

---

# 6. Code must match the current VitNode API

Never invent an API because it looks plausible.

Before rewriting technical documentation:

1. inspect the existing implementation when available
2. inspect existing VitNode examples
3. preserve exact names and signatures
4. update outdated examples when the implementation changed

Prefer actual source code over old documentation when they disagree.

If behavior cannot be verified, do not state it as fact.

---

# 7. Page structure

## How-to page

Prefer this structure:

````mdx
---
title: Do something
description: Short sentence describing the result.
---

Short introduction describing what the reader will achieve.

## Example

```ts
// smallest useful working example
```
````

Brief explanation.

## Steps

<Steps>

<Step>

### First action

Explain only what is necessary.

```ts
// code
```

</Step>

<Step>

### Next action

```ts
// code
```

</Step>

</Steps>

## Next steps

<CardGroup>
  ...
</CardGroup>
```

Not every guide needs every section.

For very small tasks, skip `Steps` and show the solution directly.

---

## Reference page

Prefer this structure:

````mdx
---
title: API name
description: What this API represents.
---

One short description.

## Usage

```ts
// minimal example
```
````

## Parameters

<TypeTable ... />

## Behavior

Explain behavior that cannot be expressed by the type signature.

## Examples

### Example name

```ts
// example
```

## Related APIs

Cards or normal links.

````

The reference page should make it easy to answer:

- What is this?
- How do I call it?
- Which options exist?
- Which values are required?
- What does it return?
- What are the defaults?
- What are the important edge cases?

---

## Explanation page

Prefer this structure:

```mdx
---
title: Concept
description: Short description of the concept.
---

Explain the concept in 1–2 short paragraphs.

## How it works

Explain the architecture or data flow.

## Example

```ts
// example if useful
````

## Why VitNode works this way

Explain relevant design decisions and tradeoffs.

## Related concepts

Links or cards.

````

Do not convert explanation pages into step-by-step tutorials.

---

# 8. Fumadocs components

Use Fumadocs components to improve comprehension and scanning.

Do not use components purely for decoration.

---

## Steps

Use `Steps` for sequential actions that must be completed in order.

```mdx
import { Step, Steps } from "fumadocs-ui/components/steps";

<Steps>

<Step>

### Create the plugin

```ts
export const blogPlugin = createPlugin({
  id: "blog",
});
````

</Step>

<Step>

### Register it

Add the plugin to your VitNode configuration.

</Step>

</Steps>
```

Do not use Steps when there is only one action.

---

## Tabs

Use Tabs when the reader can choose between equivalent approaches.

Good uses:

- pnpm / npm / bun
- server / client
- JavaScript / TypeScript
- different adapters

Example:

````mdx
<Tabs items={["pnpm", "npm", "bun"]}>

<Tab value="pnpm">

```bash
pnpm add package-name
```
````

</Tab>

<Tab value="npm">

```bash
npm install package-name
```

</Tab>

<Tab value="bun">

```bash
bun add package-name
```

</Tab>

</Tabs>
```

Do not duplicate large sections inside Tabs.

---

## Callouts

Use Callouts only for information that deserves extra attention.

Use them for:

- important constraints
- breaking behavior
- security implications
- common mistakes
- compatibility notes
- destructive operations

Example:

```mdx
<Callout type="warn" title="Server only">
  This API can only be called from the server.
</Callout>
```

Do not put normal documentation paragraphs inside Callouts.

Too many callouts make every callout meaningless.

---

## Cards

Use Cards to help readers navigate to related concepts or next steps.

Good:

```mdx
<Cards>
  <Card
    title="Create a plugin"
    href="/docs/plugins/create"
  />

  <Card
    title="Plugin configuration"
    href="/docs/plugins/configuration"
  />
</Cards>
```

Use Cards mainly for navigation.

Do not replace normal prose with dozens of cards.

---

## TypeTable

Use `TypeTable` for APIs, options, configuration objects, and props.

Prefer it over manually written Markdown tables when documenting structured
TypeScript configuration.

Example:

```mdx
import { TypeTable } from "fumadocs-ui/components/type-table";

<TypeTable
  type={{
    plugin: {
      description: "Plugin that owns the API.",
      type: "Plugin",
      required: true,
    },
    method: {
      description: "HTTP method.",
      type: `"GET" | "POST" | "PUT" | "DELETE"`,
      required: true,
    },
    path: {
      description: "API route inside the plugin.",
      type: "string",
      required: true,
    },
  }}
/>
```

Keep descriptions short.

Do not repeat the property name in its description.

Bad:

> `path` — The path property containing the path.

Good:

> `path` — API route inside the plugin.

---

## Files

Use a file tree when location matters.

Example:

```mdx
<Files>
  <Folder name="src" defaultOpen>
    <Folder name="plugins" defaultOpen>
      <File name="blog.ts" />
    </Folder>
  </Folder>
</Files>
```

Use this when the reader needs to understand where code belongs.

Do not manually describe a complex folder structure in prose.

---

## Accordion

Use an Accordion for secondary information that most readers do not need.

Examples:

- migration notes
- implementation details
- uncommon edge cases
- advanced configuration

Do not hide core instructions inside accordions.

---

# 9. Package installation

When installation is required, support:

- pnpm
- npm
- bun

Prefer Fumadocs package-install/tab syntax already configured in the VitNode
documentation.

Do not manually create three repetitive sections if the docs already support
package-manager tabs.

Keep commands equivalent.

Example intent:

```bash
pnpm add package-name
npm install package-name
bun add package-name
```

---

# 10. Headings

Use descriptive headings.

Good:

## Register the route

## Load posts

## Cache the result

Bad:

## Usage

## Example 1

## More information

Headings should help someone understand the page from the table of contents.

Avoid excessive heading depth.

Usually stop at `###`.

---

# 11. Titles

Prefer task-oriented titles for How-to pages.

Good:

- Create a plugin
- Add a custom route
- Fetch data from another plugin
- Add an AdminCP navigation item

Avoid:

- Plugin Creation Guide
- Working With Routes
- Understanding How Fetching Works in VitNode

Reference pages can use API names:

- `fetcher()`
- `createPlugin()`
- `PluginConfig`
- Content fields

Explanation pages can use concepts:

- Plugin architecture
- Cache system
- Content localization

---

# 12. Introductions

The introduction should normally be 1–3 sentences.

For How-to documentation, immediately state the result.

Good:

> Use `fetcher()` to call an API exposed by another VitNode plugin. It works
> with the plugin's typed API definition, so the request and response stay
> type-safe.

Avoid:

> VitNode provides a powerful and flexible mechanism that makes communication
> between plugins easy and efficient. In this guide, we will explore how the
> fetcher utility works and how developers can take advantage of it.

---

# 13. Explain after the example

For practical APIs, prefer:

1. short introduction
2. working example
3. explanation
4. options
5. edge cases

instead of:

1. long architecture explanation
2. terminology
3. configuration theory
4. example at the bottom

Let developers see the solution first.

---

# 14. Progressive disclosure

Keep the common path obvious.

Move advanced information later.

Preferred order:

1. common usage
2. important behavior
3. options
4. advanced usage
5. edge cases

Do not make beginners understand every internal detail before they can use an
API.

---

# 15. Avoid duplication

Do not explain the same concept on many pages.

Instead:

```md
See [Plugin permissions](/docs/plugins/permissions).
```

A How-to page should link to the Reference page for exhaustive option details.

A Reference page should link to Explanation pages for architecture.

An Explanation page should link to How-to pages for implementation.

---

# 16. Cross-link documentation types

Whenever useful:

How-to → Reference

> See [`fetcher()`](/docs/api/fetcher) for all available options.

Reference → How-to

> See [Fetch data from another plugin](/docs/plugins/fetch-data) for a complete example.

Explanation → How-to

> To implement this, see [Add cache to a plugin](/docs/cache/plugin-cache).

This keeps individual pages short.

---

# 17. SEO and AI readability

Write headings that explicitly describe the concept.

Prefer:

> ## Fetch data from another plugin

instead of:

> ## Usage

Prefer explicit nouns in the first paragraph.

Mention the important VitNode concept naturally near the beginning.

Do not keyword-stuff.

Each page should make sense when retrieved independently by:

- search engines
- AI assistants
- documentation search
- embeddings/RAG

Avoid references like:

> As explained above...

Prefer:

> Plugin routes are registered when the plugin loads.

Each important section should retain enough context to make sense by itself.

---

# 18. Terminology

Use terminology consistently.

Do not introduce synonyms for existing VitNode concepts.

If the project uses:

- plugin
- widget
- zone
- AdminCP
- ModeratorCP
- fetcher
- content field

use exactly those terms.

Do not alternate between:

- plugin / extension / module / addon
- AdminCP / admin panel / dashboard

unless they represent different concepts.

---

# 19. API names

Always format:

- functions as `functionName()`
- properties as `property`
- types as `TypeName`
- file names as `file.ts`
- package names as `package-name`
- CLI commands as code

Example:

> `fetcher()` accepts a `plugin`, `method`, and `path`.

---

# 20. Rewrite behavior

When asked to rewrite an existing page:

1. determine the page type
2. preserve technically important information
3. remove duplicated text
4. remove filler
5. shorten paragraphs
6. move the main example toward the top
7. simplify examples
8. improve headings
9. replace long prose with suitable Fumadocs components
10. add missing realistic examples
11. link to related pages instead of duplicating them
12. preserve useful SEO terminology
13. verify examples against the current API when source is available

Do not preserve bad structure simply because the original page used it.

Rewrite aggressively when clarity improves.

---

# 21. Editing checklist

Before finishing, check:

### Content

- Is the page clearly How-to, Reference, or Explanation?
- Is the purpose obvious from the first paragraph?
- Is important information missing?
- Is anything repeated?

### Examples

- Is there a useful example near the beginning?
- Is the example realistic?
- Is it small enough?
- Does it use current VitNode APIs?
- Can it be copied with minimal modification?

### Writing

- Can any paragraph be shorter?
- Can any sentence be simpler?
- Is there filler?
- Is active voice possible?
- Is terminology consistent?

### Structure

- Are headings descriptive?
- Can someone scan the page without reading everything?
- Should any section become Steps, Tabs, TypeTable, Files, Cards, or a Callout?
- Are components being used because they help, rather than because they look nice?

### Reader experience

A developer should be able to answer:

> What do I need to do?

within roughly 10 seconds of opening a How-to page.

A developer should be able to answer:

> What options does this API accept?

within roughly 10 seconds of opening a Reference page.

A developer should be able to answer:

> How does this concept work?

from the first few paragraphs of an Explanation page.

---

# 22. Output format

When creating a documentation page, output complete MDX ready to place in the
VitNode documentation.

Do not include commentary before or after the document unless requested.

Preserve frontmatter when editing an existing page unless it should be updated.

Use existing VitNode/Fumadocs components when available.

Do not invent custom components unless requested.

---

# 23. Preferred VitNode documentation style

Aim for documentation that feels closer to:

- Vercel
- Cloudflare
- Stripe
- Resend

than to a long-form framework manual.

Prioritize:

**working example → concise explanation → details**

over:

**introduction → theory → terminology → long explanation → example**

The goal is not to make documentation as short as possible.

The goal is to make it as short as possible **without removing information the
developer needs**.

```

A few details here are based on current Fumadocs behavior: `Steps`/`Step`, `Tabs`/`Tab`, and `TypeTable` are supported components, while the default MDX set includes things like Cards, Callouts, code blocks, and headings. Fumadocs also supports `Files`, Accordions, auto type tables, and other docs-oriented components.

One change I'd make in your actual VitNode repository is to **teach the skill the exact components already registered in `components/mdx.tsx`**. Then the agent won't introduce `<TypeTable>`, `<Files>`, or `<Steps>` on a page if VitNode hasn't installed/registered that component yet. Fumadocs requires additional components such as Tabs/Steps to be registered or installed when they're not already part of your MDX setup.

For VitNode specifically, I'd also consider adding **Tutorial** later as a fourth type, but I would keep it out for now if your docs are mainly task-oriented. How-to + Reference + Explanation covers most of the developer documentation you've been working on without making the structure more complicated than necessary.
```
