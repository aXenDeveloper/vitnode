# Marketing plan

Status: draft, not started. Owner: maintainer. Written 2026-11-24, covers
2026-12 to 2027-11. Scored from the repository and the running site, not from
analytics (there are none yet).

Assumptions to confirm (see "Open decisions"): one maintainer plus
contributors, a marketing budget of $0, GitHub Sponsors as the only income, and
no fixed date for the stable 2.0 release.

## Summary

VitNode has a strong product and strong docs (395 pages) and almost no
distribution: no analytics, no comparison pages, no email list, no launch
history, and a home page that never says "forum" or "blog" above the fold.

Three bets for the next 12 months:

1. **Make the site prove "easy".** The home page becomes a hub that answers
   "what can I build?" with real code and real screens, and hands off to
   solution, feature and comparison subpages.
2. **Win the moment of choice through search.** People pick a community
   platform once every few years. Solution pages, comparison pages and
   tutorials are the assets that are there when they look, and they take months
   to rank, so they start now.
3. **Sell to builders now, to community owners after stable.** While 2.0 is a
   canary, the audience is developers and plugin authors. The big one-shot
   launches wait for the stable release.

90-day outcome: analytics live, new home page, forum and blog solution pages,
`@vitnode/forum` installable from npm, first two comparison pages, a changelog
and a way to follow releases.

12-month outcome: a measured funnel from search to a running app, a ranked set
of solution and comparison pages, a plugin showcase with entries not written by
the maintainer, and a stable-release launch that lands on prepared ground.

## Goals

1. A visitor understands in ten seconds what VitNode is and what they can build
   with it.
2. A developer gets from the home page to a running app with a forum in one
   sitting.
3. Every claim on the site is true in the code today, or labelled as "build it"
   or "planned".
4. Each piece of marketing work is an asset that keeps paying: a page that
   ranks, a tutorial that gets linked, a plugin that gets installed.
5. Every move has a number that says whether it worked.

Non-goals: paid advertising, outbound sales, a paid tier, growth of the
vitnode.com member count for its own sake.

## Strategic frame

**One sentence.** VitNode is an open-source community framework: members,
roles, moderation, search and an admin panel are built in, and every feature (a
forum, a blog, your own idea) is a plugin.

**Category.** "Community framework". It sits between forum software, which is
finished but hard to reshape, and a web framework, where you build accounts,
roles and an admin panel yourself.

**Who it is for.**

| Audience | Reachable | What they want |
| --- | --- | --- |
| Builders: developers, agencies, plugin authors on the TanStack/Hono/Drizzle stack | Now | A head start on accounts, roles, admin and content, with code they own |
| Community owners: people who run a forum, a membership site or a help center | After stable 2.0 | A community on their own domain, no per-member bill, no lock-in |

The FAQ already says VitNode is not for production yet. The plan respects
that: until stable, copy for community owners says "explore and prototype".

**Problem size and frequency.** The problem is large (a community site is
months of work to build) and rare (the choice is made once per project). Rare
problems are won by being found at the moment of choice, not by staying in the
feed. That is why search assets and comparison pages lead this plan and social
posting does not.

**What people use instead.**

| Alternative | Where it falls short | Our answer |
| --- | --- | --- |
| Forum software (Discourse, Flarum, NodeBB, Invision Community) | A finished product; new features fight the core | Features are plugins, the forum itself included |
| Hosted community services (Circle, Skool, a Discord server) | Per-member or per-seat pricing, their database, their rules | MIT, self-hosted, your data |
| A web framework plus an auth library | Months on accounts, roles, moderation and admin before the first feature | Those parts ship in core |
| A headless CMS (Payload, Strapi) | Content, but no members, moderation or community features | One definition gives content and community |

Every row is a hypothesis until it is checked against the competitor's own
documentation. Nothing from this table goes on the site unverified.

**Proof we can show today.** One content type definition generates a table,
validation, an API, permissions and AdminCP screens. Blog installs from npm.
15 sign-in providers, passkeys, roles, a moderator panel, notifications,
search, AI actions and per-field translations are in core. vitnode.com itself
runs on VitNode, forum and blog included.

**Voice.** Friendly, lightly funny, plain words. Honest about canary. No
invented numbers, logos or quotes.

**Feature truth.** Marketing copy follows this table.

| Use case | In the repo | Label on the site |
| --- | --- | --- |
| Blog | `@vitnode/blog`, public on npm | Install today |
| Forum | `@vitnode/forum`, `private`, not on npm | In the repo; "install today" once published |
| Shop | One-time checkout through `@vitnode/stripe`; no catalog, cart, tax or refunds | Build it on payments |
| Company or team workspace | Nothing dedicated; roles, staff permissions, audit logs, Content Engine | Build it as a plugin |

## Current state

Team: one maintainer, who is also the only marketer. Budget: $0. Phase: before
the first stable release, so the binding constraint is attention, not
conversion.

**Already done, and worth building on.** 395 docs pages with a step-by-step
learning path; `llms.txt`, `llms-full.txt` and Markdown routes for AI agents;
a marketing design system (`apps/web/src/site/marketing`); five solution pages
on a data-driven template with available/plugin/roadmap checklists; a plugins
page; generated social cards; structured data for docs, FAQ and marketing
pages; prerendered marketing routes; English and Polish site copy.

**Stuck or missing.**

- No analytics anywhere on the site, so nothing below can be measured yet.
- The hero's primary button goes to `/solutions`, which is not in the header.
- The home page has no install command and no closing call to action.
- The footer's "Pricing: $0, forever" links to `/#pricing`, which does not
  exist.
- The `/plugins` title and description still mention "the example plugin",
  which was replaced by `newsroom`.
- `PluginsSection` (`apps/web/src/site/home/sections/plugins.tsx`) is written
  but not on the home page.
- The forum plugin cannot be installed outside the monorepo.
- No changelog page, no release feed, no email capture.

**Scorecard** (0 to 5, scored from materials).

| Area | Score | Note |
| --- | --- | --- |
| Positioning | 2 | Clear in metadata, abstract in the hero, not written down |
| Customer research | 0 | None in the repo |
| Home page | 2 | Good craft, no use cases, no start action |
| Product pages | 2 | Plugins and five solutions; no feature pages, no forum or blog page |
| Conversion pages | 1 | Setup doc is good; nothing leads to it |
| Competitor comparison | 0 | None |
| Resources and content | 4 | Docs are the strongest asset |
| Onboarding | 3 | Generator and learning path; time to first forum unmeasured |
| Email lifecycle | 0 | None |
| Messaging | 2 | Strong voice, a few stale claims |
| Pricing | 3 | "$0, MIT" is clear; dead anchor |
| Conversion optimisation | 0 | No data |
| Launches | 1 | No launch history found |
| SEO | 3 | Solid technical base; few pages aimed at buyer searches |
| Internationalisation | 2 | Site in English and Polish, docs in English |

Total 25 of 75. Paid ads and sales material are left out on purpose. Shape:
strong product, weak distribution and no measurement.

## Acquisition

How strangers find VitNode. All organic.

| Channel | Now | Move |
| --- | --- | --- |
| Search: buyer intent | None | Solution pages, comparison pages |
| Search: builder intent | Docs rank by accident | Tutorials that build one real thing end to end |
| AI answers | `llms.txt` exists | Clear "what it is / who it is for" passages on every hub page |
| GitHub and npm | README is plain | README that mirrors the new home page; topics; a screenshot |
| Developer communities | Unknown | Tutorials shared where the stack's users are; no drive-by links |
| Directories and lists | Unknown | Open-source alternative lists, awesome lists for the stack |
| Launch sites | Not used | One launch, at stable 2.0 |

Moves, in order:

1. **Site restructure.** Header becomes Product, Solutions, Plugins, Docs, Blog
   plus a "Get started" button. Home becomes: hero with the install command,
   "What do you want to build?" tabs (Forum, Blog, Shop, Team workspace, Your
   own), the one-file code section, "the boring parts, already done", why
   VitNode, "this site runs on it", stack, FAQ, closing call to action.
2. **Solution pages** for Forum and Blog first, then Shop and Team workspace.
   The existing template and `Availability` labels already fit.
3. **Feature pages** under `/features`: Content Engine, AdminCP, Members and
   roles, Moderation, Search, Notifications, AI, Translations, Payments. Each
   is the benefit version of a docs section and ends with a link into it.
4. **Comparison pages** under `/compare`, one per alternative, with a "when the
   other tool is the better choice" section. Start with the two that the first
   keyword check shows the most demand for.
5. **Tutorials** on the blog, each one buildable in an evening: a forum with
   nested comments, a members-only blog, a paid download with Stripe, a help
   center with search.
6. **Integration pages** generated from the existing adapter registry (sign-in
   providers, storage, email), one per integration, only if each page can carry
   real setup steps and a screenshot. Thin pages are worse than none.

One asset, several uses: each solution page is also a tutorial outline, a blog
post, a short screen recording and a README section.

## Activation

The activation event is a running app with a first plugin enabled.

- **Time to first forum.** Record a clean run from `create vitnode-app` to a
  topic posted in the forum, write down every prompt, wait and error, and fix
  the three worst. Repeat each quarter.
- **Publish `@vitnode/forum`.** "Add a forum in two lines" is the strongest
  demo and is only true inside the monorepo today.
- **Generator handoff.** The last screen of `create vitnode-app` names the next
  three steps and links the guide for the plugin most people want next.
- **Use-case presets.** Offer "blog" and "forum" as choices in the generator so
  the first run already contains the thing the visitor came for. Size this
  before promising it.
- **Guides index.** `/docs/guides` lists two guides; the forum guide exists but
  is not on that page. Add it, then a guide per solution page.
- **Live demo.** Label vitnode.com's own forum, blog and Discover as the demo
  and link them from the home page. A resettable demo AdminCP is a later
  option, with real abuse risk to weigh.

## Retention

Keeping builders through the canary period and beyond.

- **Changelog.** A `/changelog` page fed from releases, with a feed.
- **Release notes that say what to do.** Every canary with a breaking change
  gets "what breaks, what to run". The AdminCP update widget already announces
  new versions; link it to the matching entry.
- **Follow releases by email.** vitnode.com runs VitNode, so its members and
  notification digests are the list. Check that a digest can carry an
  announcement; if it can, there is no new tool to add.
- **One place to ask.** Make the vitnode.com forum the support home and answer
  there first, so answers become searchable pages.
- **Roadmap page.** Public, short, dated when a date is real.

## Referral

- **Showcase.** A page of sites and plugins built with VitNode. Entry one is
  vitnode.com. No invented entries; an empty slot with "add yours" is fine.
- **Plugin authors.** A catalog of community plugins, a "plugin of the month"
  post, and docs for publishing one. Plugin authors bring their own audience.
- **Ask at the right moment.** A link to the repository at the end of a
  successful generator run and in the AdminCP "about" area.
- **"Built with VitNode"**, an optional footer line in generated apps. Opt-out
  or opt-in is an open decision.
- **Contributor credit.** Name contributors in release notes.

## Revenue and sustainability

VitNode is free and MIT-licensed, and the footer promises "$0, forever". There
is no revenue plan here, only sustainability:

- Make GitHub Sponsors visible: a sponsor section on the site and in the
  README, with what sponsorship pays for.
- Any future paid layer (hosting, support, paid plugins) must leave the
  framework free, or the footer promise becomes a liability. This is an open
  decision and is out of scope for this plan.

## 90-day roadmap

Weeks count from the start date. "Agent" means the work can be handed to a
coding session and reviewed by the maintainer.

**Weeks 1-2: unblock**

| Move | Stage | Owner |
| --- | --- | --- |
| Add privacy-friendly analytics; define events for install-command copy, "Get started", docs setup page, outbound GitHub | Measurement | Maintainer picks the tool, agent wires it |
| Record baselines: weekly `create-vitnode-app` downloads, stars, sponsors, forum members | Measurement | Maintainer |
| Fix the dead `/#pricing` link and the stale `/plugins` metadata | Acquisition | Agent |
| Add Solutions to the header | Acquisition | Agent |
| Write `.agents/product-marketing.md` from the "Strategic frame" above | All | Agent drafts, maintainer corrects |
| Keyword check for solution and comparison pages | Acquisition | Maintainer |

**Weeks 3-4: foundation**

| Move | Stage | Owner |
| --- | --- | --- |
| New hero with the install command and a closing call to action | Acquisition | Agent |
| "What do you want to build?" section on the home page | Acquisition | Agent |
| One-file code section | Acquisition | Agent |
| Publish `@vitnode/forum` to npm; update the guide and the guides index | Activation | Maintainer |
| First timed run of "time to first forum" | Activation | Maintainer |

**Weeks 5-8: velocity**

| Move | Stage | Owner |
| --- | --- | --- |
| Solution pages: Forum, Blog | Acquisition | Agent |
| Feature pages: Content Engine, AdminCP, Members and roles | Acquisition | Agent |
| Changelog page and feed | Retention | Agent |
| README rewritten to mirror the home page | Acquisition | Agent |
| Tutorial 1: a forum with nested comments | Acquisition | Maintainer |
| Fix the three worst steps from the timed run | Activation | Maintainer |

**Weeks 9-12: compound**

| Move | Stage | Owner |
| --- | --- | --- |
| First two comparison pages | Acquisition | Agent drafts, maintainer verifies every claim |
| Solution pages: Shop, Team workspace, labelled "build it" | Acquisition | Agent |
| Showcase page | Referral | Agent |
| Release announcements through the site's own digest | Retention | Maintainer |
| Sponsor section | Sustainability | Agent |
| Tutorial 2: a members-only blog | Acquisition | Maintainer |
| Review the numbers; cut what did nothing | All | Maintainer |

## 12-month outlook

| Quarter | Focus | Exit check |
| --- | --- | --- |
| Q1, Dec-Feb | Foundations: measurement, home page, forum and blog pages, forum on npm | Funnel visible from home to setup doc; forum installs from npm |
| Q2, Mar-May | Search assets: remaining feature pages, four comparison pages, a tutorial a month, directory listings | First non-brand search visits on solution and comparison pages |
| Q3, Jun-Aug | Ecosystem: plugin catalog, showcase with outside entries, generator presets, integration pages if they pass the quality bar | At least one plugin and one site not built by the maintainer |
| Q4, Sep-Nov | Stable launch, if 2.0 is ready: launch post, launch sites, community-owner copy replaces "explore and prototype" | Launch run from a written checklist; community-owner pages live |

If stable slips, Q4 repeats Q2 and Q3 work. The launch is not moved earlier to
fill the slot.

Effort split: about 70% on site and search assets, 20% on activation and the
plugin ecosystem, 10% on experiments, each with a date on which it is kept or
dropped.

## Measurement

North star: **new apps started per week**, read from weekly downloads of
`create-vitnode-app` on npm. It is public, needs no telemetry, and moves when
the funnel works. Downloads include CI and bots, so read the trend, not the
absolute number.

| Stage | Leading indicator | Source |
| --- | --- | --- |
| Acquisition | Non-brand search visits to solution, feature and comparison pages | Search console, site analytics |
| Acquisition | Home page visits that reach the setup doc | Site analytics |
| Activation | Install-command copies; setup doc visits that reach "Create plugin" | Site analytics |
| Activation | Minutes from generator to first forum topic | Quarterly timed run |
| Retention | Downloads of the newest canary within two weeks of release | npm |
| Retention | Returning visitors to docs and changelog | Site analytics |
| Referral | Stars, showcase entries, community plugins | GitHub, the site |
| Sustainability | Sponsors and monthly amount | GitHub Sponsors |

Review monthly. Record the baselines in week 1 in this file, under a "Numbers"
heading, so later sessions can see the trend.

## Tools for the work

| Work | Skill |
| --- | --- |
| Positioning file | `product-marketing` |
| Navigation and URL structure | `site-architecture` |
| Page copy | `copywriting`, then `emil-unslop-writing` |
| Page build | `marketing-pages`, `emil-unslop-design` |
| Comparison pages | `competitors` |
| Search checks | `seo-audit`, `ai-seo`, `schema` |
| Integration pages | `programmatic-seo` |
| Analytics events | `analytics` |
| Listings | `directory-submissions` |
| Stable launch | `launch` |

## Not doing, and why

- **Paid ads.** No budget, and a rare purchase converts poorly from interruption.
- **A launch before stable.** A launch can be spent once; spending it on a
  build the FAQ calls "not for production" wastes it.
- **Daily social posting.** Low return for a rare problem and one person.
- **Invented proof.** No made-up testimonials, user counts, logos or benchmarks.
- **Claims ahead of the code.** Shop and team workspace stay "build it" until a
  plugin exists.
- **Usage telemetry in the CLI or the app** without an explicit opt-in.
- **Translating docs.** English docs first; the site stays English and Polish.

## Open decisions

| Decision | Why it matters | Default if not decided |
| --- | --- | --- |
| Target window for stable 2.0 | Sets the launch quarter and when community-owner copy goes live | Plan around builders only |
| Hours per week for marketing | Decides how much of the roadmap is realistic | Agent-built pages only; tutorials slip |
| Analytics tool | Blocks all measurement | A cookieless, privacy-friendly tool that needs no consent banner |
| Publish `@vitnode/forum` to npm | The main demo depends on it | Site says "in the repo" and the forum tab shows monorepo steps |
| Which alternatives to compare against first | Sets weeks 9-12 | The two with the most search demand |
| "Built with VitNode" footer: opt-in or opt-out | Referral reach against goodwill | Opt-in |
| A paid layer in the future | Shapes sponsor copy and the "$0, forever" line | None; sponsors only |
| Is "company management" a real target | No code exists for it | Shown as "Team workspace, build it", not in the hero |

## Related

- `apps/web/src/site/home/home-content.tsx`: home page sections.
- `apps/web/src/site/solutions/data.ts`: solution page data and template types.
- `apps/web/src/site/marketing/metadata.ts`: marketing page titles and descriptions.
- `apps/web/src/vitnode.config.ts`: header navigation.
- `apps/web/content/docs/guides`: guides that solution pages link into.
