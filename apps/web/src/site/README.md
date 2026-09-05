# VitNode website

The homepage explains VitNode for people choosing a community framework.
Keep the copy friendly, brief, and grounded in the current canary docs.

- `home/home-content.tsx`: benefits, feature cards, comparison, maker note,
  canary status, and calls to action.
- `home/visuals.tsx`: illustrative community preview and the plugin diagram.
  The preview is not an available theme or an interactive product demo.
- `home/metadata.ts`: homepage title and search description.
- `../components/main-footer.tsx`: shared footer for every `_main` route,
  including public plugin pages. Keep it outside the main landmark.
- `../styles.css`: `.main-site` light/dark tokens and `.home-*` styles.
  The website palette is scoped so it does not change AdminCP or docs themes.

Use `RouterLink` (or the homepage's injected `LinkComponent`) for internal
links to preserve locale-aware routing. External links use normal anchors.
Keep the existing header's navigation, account, language, and theme controls.

## Copy sources

Member accounts and permissions: `content/docs/dev/advanced/auth.mdx` and
`content/docs/dev/working-with-users/`. Content tools: `content/docs/dev/content-engine/`.
Plugins and AdminCP: `content/docs/dev/plugins/`. Languages: `content/docs/dev/i18n/`.
Hosting: `content/docs/dev/deployments/self-hosted.mdx`. Blog: `content/docs/guides/blog.mdx`.
All paths are relative to `apps/web`.

The comparison describes approaches, not named competitors or benchmarks.
Do not add customer logos, adoption figures, savings, or performance claims
without evidence. Keep the early-build notice above the pitch and explain
breaking changes and business-critical limitations in the canary section.

## Assets and motion

The AdminCP screenshot is the existing project asset. `maciej-avatar.png`
is the creator's public GitHub avatar (user 58148176), retrieved from
https://avatars.githubusercontent.com/u/58148176?v=4&s=256.
Both images are local, dimensioned, and lazy-loaded below the fold.
Existing social-preview metadata is unchanged.

Motion uses CSS only: a short preview entrance and a finite SVG connection
animation, tied to scrolling when supported. Reduced-motion users get static
content. Do not hide essential copy until JavaScript or an animation runs.
