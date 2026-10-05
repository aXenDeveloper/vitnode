# Documentation site preferences

Apply these preferences when the task includes documentation-site infrastructure, layout, performance, or accessibility. Follow the existing framework, styling system, and Fumadocs version. Do not add unrelated marketing features to an MDX-writing task.

## Copy and export

- Provide keyboard-accessible copy controls for code snippets with visible success feedback and no dependency on hover alone. Preserve indentation and copy runnable code, not rendering annotations.
- Provide "Copy as Markdown" and a predictable raw Markdown URL for public pages, using existing routing conventions. Implement a `.md` route when compatible with the site, not an invented URL in page text.
- Serialize content meaningfully: steps become headings/instructions, tabs retain labeled alternatives, callouts retain their messages, and images retain alt text and resolvable sources. Remove renderer-only markup and secret/private data.
- Test one exported page with steps, tabs, code, and images. Keep canonical HTML URLs stable; ensure internal links and assets work when reading the export.

## Readability, accessibility, and motion

- Keep document text and navigation links in server-rendered HTML when supported. Make closed navigation submenus available without fetching them on hover. Hide them accessibly and prevent focus on closed items; provide keyboard controls and accurate expanded state.
- Use a logical heading hierarchy, descriptive links, readable code on narrow screens, and balanced multi-line headings when the project's styling supports it.
- Avoid scroll-triggered reveals, scroll hijacking, parallax, auto-advancing carousels, and intro animations in docs. Keep content visible immediately. Respect reduced-motion preferences for necessary interaction feedback.
- Give informative diagrams and illustrations a useful text alternative. Mark purely decorative images as decorative. Do not disable pointer events or text selection on real content or interactive examples.

## Performance

- Prefer build-time generation or the site's existing cached rendering/revalidation strategy for public docs. Do not force a new rendering architecture or prohibit request-time rendering where content, authorization, or deployment requires it.
- Reserve image space using dimensions or aspect ratio supported by `img.tsx`. Compress screenshots while retaining readable text; lazy-load below-the-fold images.
- Prioritize only critical above-the-fold images and fonts. Reuse existing font loading and preload mechanisms; avoid preloading every asset or duplicating requests.
- Check for layout shifts, readable first render, responsive images, and unnecessary client JavaScript. Keep static content static where practical.

Keep RSS feeds, auth-dependent CTAs, and marketing intro effects outside this docs skill unless a separate user request explicitly includes those surfaces.

## SEO and AI discovery

Apply these checks to public documentation. Preserve access controls on private content. Verify current crawler guidance from official sources before changing bot policies; search retrieval and model training policies are separate decisions.

- Provide a unique page title and useful description, one rendered H1, logical headings, a canonical HTML URL, and crawlable internal links. Do not enforce arbitrary character quotas or claim metadata guarantees a particular search snippet.
- Include important text, code, and links in the initial HTML where feasible. Verify a direct request to a deep link returns meaningful content with the correct status, not an empty client shell, soft 404, or login page.
- Maintain a sitemap of canonical, public, indexable pages. Use accurate modification dates. Verify redirects, canonical tags, robots directives, and HTTP status codes agree after page splits or moves.
- Make translations and versioned docs identifiable. Use the project's supported language/version metadata; avoid incorrect canonicalization that hides distinct content.
- Inspect `robots.txt`, robots meta/header directives, and CDN/WAF behavior when crawler access is in scope. For ChatGPT search visibility, check the current OAI-SearchBot guidance. Treat GPTBot training policy independently; never broaden training permissions as an incidental SEO change. Honor the site's owner policy.
- Use structured data only when it accurately represents visible content and the chosen type is supported. Prefer appropriate breadcrumb metadata through existing infrastructure. Do not invent ratings, authors, dates, FAQs, or promise rich results for unsupported documentation schema.
- Keep raw Markdown discoverable through a real link or supported export mechanism. Resolve exported links and image sources relative to the document or as absolute public URLs. Keep the HTML page as the primary public page unless the project's canonical strategy says otherwise.
- Treat `llms.txt` as an optional agent discovery index, not a replacement for HTML, robots rules, or a sitemap, and not a requirement or ranking factor. Add it only when included in the site task. Generate it from real public pages with canonical URLs, brief descriptions, and current versions; do not invent routes or expose private content.
- Confirm changed pages through direct HTML/Markdown requests, metadata inspection, link checks, and the existing build. Use available crawl diagnostics when authorized. A successful check does not guarantee retrieval or citation by any service.

Authoritative references for verification, not text to copy into reader-facing docs:

- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.openai.com/api/docs/bots
