# newsroom

This is the plugin the [Content Engine docs](https://vitnode.com/docs/content-engine) build step by step. It kept growing, and now it's a tour of what the engine can do. Read it, copy it, rename it.

## What is inside

| Area | Where | Shows |
| --- | --- | --- |
| Articles, categories, comments | `src/content/article.ts`, `category.ts`, `comment.ts`; pages at `/news` | The tutorial: public API, delivery, member writing, threads, reports |
| Stories | `src/content/story.ts`; `/stories/:slug` | Files, scheduling, live editing, SEO, search, an AI teaser action, a moderation scope |
| Explainers | `src/content/explainer.ts`; `/explainers/:slug` | To-many relations, groups, repeatable rows, localization |
| Bulletins | `src/content/bulletin.ts`; `/bulletins/:slug` | A localized content type with per-language editorial |
| Tags and events | `src/content/tag.ts`, `event.ts`; `/events/:slug` | `uuid` and `bigint` id strategies, relations across them |
| Desks and letters | `src/content/desks.ts`, `letter.ts`; `/desks`, `/letters` | A container tree and member-written records filed in it |
| Pages and widgets | `src/content/page.ts`, `settings-page.ts`, `src/widgets/`; `/newsroom/zones` | Block fields, editable pages, content zones, block variants |
| Routing demos | `src/routes.ts`; `/newsroom/browse`, `/newsroom/guide`, `/newsroom/embed` | Search contracts, layouts, the blank area |
| AdminCP | `src/admin/nav.tsx`; `/admin/newsroom` | Content screens, containers and a plugin page |

## Develop

```bash
vitnode dev       # rebuild dist/ on every change
vitnode build     # one-off build
vitest            # run the plugin's tests
vitnode plugin validate newsroom
```

Docs: https://vitnode.com/docs/dev/plugins
