import type { CompareSlug } from './catalog'

import { COMPARE_SLUGS, compareEntry } from './catalog'

export const CHECKED_ON = '2026-10-19'
export const CHECKED_ON_LABEL = '19 October 2026'

export type Support =
  | 'builtIn'
  | 'missing'
  | 'official'
  | 'paid'
  | 'soon'
  | 'thirdParty'
  | 'undocumented'

export interface Cell {
  note?: string
  support: Support
}

export type FeatureKey =
  | 'adminInstall'
  | 'ai'
  | 'articles'
  | 'auditLog'
  | 'contentTranslation'
  | 'dataExport'
  | 'elasticsearch'
  | 'forums'
  | 'importers'
  | 'passkeys'
  | 'reactions'
  | 'realtime'
  | 'reportsApprovals'
  | 'restApi'
  | 'socialSignIn'
  | 'twoFactor'
  | 'warningsBans'
  | 'webhooks'

export type FactKey = 'hosted' | 'licence' | 'selfHosted' | 'stack'

export interface FeatureGroup {
  features: { key: FeatureKey; label: string }[]
  title: string
}

export const FACTS: { key: FactKey; label: string }[] = [
  { key: 'licence', label: 'Licence' },
  { key: 'selfHosted', label: 'Self-hosted price' },
  { key: 'hosted', label: 'Managed hosting' },
  { key: 'stack', label: 'Stack' },
]

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    features: [
      { key: 'forums', label: 'Forums' },
      { key: 'articles', label: 'Articles or blog' },
      { key: 'contentTranslation', label: 'Translations of member content' },
      { key: 'reactions', label: 'Reactions' },
      { key: 'realtime', label: 'Realtime updates' },
    ],
    title: 'Community and content',
  },
  {
    features: [
      { key: 'reportsApprovals', label: 'Reports and approval queue' },
      { key: 'warningsBans', label: 'Warnings and bans' },
      { key: 'socialSignIn', label: 'Social sign-in and SSO' },
      { key: 'passkeys', label: 'Passkeys' },
      { key: 'twoFactor', label: 'Two-factor authentication' },
      { key: 'auditLog', label: 'Staff audit log' },
      { key: 'dataExport', label: 'Personal data export' },
    ],
    title: 'Moderation and security',
  },
  {
    features: [
      { key: 'ai', label: 'Built-in AI features' },
      { key: 'elasticsearch', label: 'Elasticsearch search' },
      { key: 'restApi', label: 'REST API' },
      { key: 'webhooks', label: 'Webhooks' },
      { key: 'adminInstall', label: 'Install extensions from the admin panel' },
      { key: 'importers', label: 'Importers from other platforms' },
    ],
    title: 'Platform',
  },
]

export interface Product {
  facts: Record<FactKey, string>
  features: Record<FeatureKey, Cell>
}

export interface Difference {
  text: string
  title: string
}

export interface Source {
  label: string
  url: string
}

export interface Competitor extends Product {
  advantages: Difference[]
  differences: Difference[]
  faq: { answer: string; question: string }[]
  migration: string
  name: string
  pickThem: string[]
  pickVitnode: string[]
  positioning: string
  slug: CompareSlug
  sources: Source[]
  summary: string
  url: string
}

export const VITNODE: Product = {
  facts: {
    hosted: 'No managed plan. Deploy to Vercel or your own server',
    licence: 'Open source, MIT',
    selfHosted: 'Free',
    stack: 'TypeScript: TanStack Start, Hono, Drizzle, PostgreSQL',
  },
  features: {
    adminInstall: {
      note: 'Plugins are packages a developer or an AI agent adds',
      support: 'soon',
    },
    ai: {
      note: 'AI actions with budgets per role, automatic ALT text, any provider',
      support: 'builtIn',
    },
    articles: { note: 'Blog plugin', support: 'official' },
    auditLog: { support: 'soon' },
    contentTranslation: {
      note: 'Per-field translations, localized URLs, hreflang',
      support: 'builtIn',
    },
    dataExport: { support: 'soon' },
    elasticsearch: {
      note: 'PostgreSQL search by default, free Elasticsearch adapter',
      support: 'official',
    },
    forums: { note: 'Forum plugin', support: 'official' },
    importers: { support: 'soon' },
    passkeys: { note: 'Opt-in', support: 'builtIn' },
    reactions: { support: 'soon' },
    realtime: {
      note: 'Live notifications and live co-editing over WebSocket',
      support: 'builtIn',
    },
    reportsApprovals: {
      note: 'ModCP reports board and approval queue',
      support: 'builtIn',
    },
    restApi: { note: 'Typed API, OpenAPI in development', support: 'builtIn' },
    socialSignIn: {
      note: 'Google, Discord, Facebook and custom OAuth2',
      support: 'builtIn',
    },
    twoFactor: { support: 'soon' },
    warningsBans: { note: 'Coming to the ModCP', support: 'soon' },
    webhooks: { support: 'soon' },
  },
}

const COMPETITORS_BY_SLUG: Record<
  CompareSlug,
  Omit<Competitor, 'name' | 'slug'>
> = {
  discourse: {
    advantages: [
      {
        text: 'Discourse lists no native article or blog type. VitNode’s blog plugin gives articles drafts, scheduling, revisions and live co-editing, on the same members, roles and search as the forum.',
        title: 'Articles next to the forum',
      },
      {
        text: 'Discourse translates posts too, and its hosted plans cap content languages at 2 to 10. VitNode has no cap and gives every language its own URL, with hreflang tags written for you.',
        title: 'Every language, no cap',
      },
      {
        text: 'A self-hosted Discourse adds a plugin by editing app.yml and rebuilding the container. A VitNode plugin is a TypeScript package you add and deploy like any other dependency.',
        title: 'Plugins without a rebuild',
      },
      {
        text: 'Discourse is GPL-2.0. VitNode’s MIT licence lets you build closed-source plugins and products on top of it.',
        title: 'MIT instead of GPL',
      },
    ],
    differences: [
      {
        text: 'Discourse is built around topics. Its site lists no native article or blog type; its blog integration embeds Discourse comments on a blog that lives somewhere else. In VitNode, the blog plugin gives articles drafts, scheduling, revisions and live co-editing, and they sit next to forum topics with the same members, roles and search.',
        title: 'Discussions first, or content and discussions together',
      },
      {
        text: 'Discourse has the deepest moderation in this comparison: trust levels, a review queue, official warnings, silencing, suspensions, staff action logs and AI spam and toxicity flagging. VitNode has a drag-and-drop reports board with assignment and notes, an approval queue per forum section and moderators limited to the sections they look after. Warnings, bans and a staff audit log are coming soon.',
        title: 'Moderation',
      },
      {
        text: 'Both translate content, not just the interface. Discourse translates posts manually or with Discourse AI, and its hosted plans cap the number of languages (2 on Free, 10 on Enterprise). VitNode stores a translation per field, gives every language its own URL and writes hreflang tags, with no language cap. Discourse AI goes further than VitNode in some places, with personas, summaries and semantic search. VitNode adds monthly budgets and points per role, and works with any provider through the Vercel AI SDK.',
        title: 'Translations and AI',
      },
      {
        text: 'A self-hosted Discourse adds a plugin by editing app.yml and rebuilding the container, and its hosted plans decide which plugins you get. A VitNode plugin is a TypeScript package. One content type definition gives you a database table, a typed API and AdminCP screens, and the docs are written so an AI coding agent can follow them.',
        title: 'Extending it',
      },
    ],
    facts: {
      hosted:
        'Free tier. Pro is $100/mo with a custom domain, API and webhooks',
      licence: 'Open source, GPL-2.0',
      selfHosted: 'Free. Official install is Docker, 2 GB RAM recommended',
      stack: 'Ruby on Rails, Ember.js, PostgreSQL, Redis',
    },
    faq: [
      {
        answer:
          'Both are free to self-host. The differences are the licence (GPL-2.0 for Discourse, MIT for VitNode), the stack (Ruby versus TypeScript) and the content model: VitNode treats articles as first-class content next to forum topics.',
        question: 'Is VitNode a free Discourse alternative?',
      },
      {
        answer:
          'Not yet. VitNode has no Discourse importer, so moving content means writing a migration script against a Discourse backup or its REST API.',
        question: 'Can VitNode import my Discourse forum?',
      },
      {
        answer:
          'No. VitNode has realtime notifications and live co-editing, but no chat and no native mobile app.',
        question: 'Does VitNode have chat like Discourse?',
      },
    ],
    features: {
      adminInstall: {
        note: 'Self-hosted plugins need app.yml and a rebuild',
        support: 'missing',
      },
      ai: {
        note: 'Discourse AI is bundled: spam, summaries, semantic search',
        support: 'official',
      },
      articles: {
        note: 'Comments embedded on an external blog',
        support: 'undocumented',
      },
      auditLog: { note: 'Staff action logs', support: 'builtIn' },
      contentTranslation: {
        note: 'Manual or AI. Hosted plans cap languages',
        support: 'builtIn',
      },
      dataExport: { note: 'Per-user archive', support: 'builtIn' },
      elasticsearch: {
        note: 'PostgreSQL search plus AI semantic search',
        support: 'undocumented',
      },
      forums: { support: 'builtIn' },
      importers: { note: '60+ import scripts', support: 'builtIn' },
      passkeys: { support: 'builtIn' },
      reactions: { note: 'Bundled plugin', support: 'official' },
      realtime: { note: 'Chat and live updates', support: 'builtIn' },
      reportsApprovals: {
        note: 'Flags, review queue, trust levels',
        support: 'builtIn',
      },
      restApi: { note: 'Hosted from Pro', support: 'builtIn' },
      socialSignIn: {
        note: 'DiscourseConnect, social logins, OIDC',
        support: 'builtIn',
      },
      twoFactor: { support: 'builtIn' },
      warningsBans: { note: 'Warnings, silence, suspend', support: 'builtIn' },
      webhooks: { note: 'Hosted from Pro', support: 'builtIn' },
    },
    migration:
      'Discourse makes your data reachable: full admin backups, per-user exports and a REST API. VitNode has no Discourse importer yet, so moving means writing a script. Discourse, on the other hand, ships more than 60 import scripts of its own, which matters if you are leaving an older forum today.',
    pickThem: [
      'You run discussions at scale and want trust levels and mature moderation.',
      'You need two-factor authentication, an audit log, data export and importers today.',
      'You want a hosted plan with a free tier.',
      'You want chat and an official mobile app.',
    ],
    pickVitnode: [
      'Articles matter as much as threads on your site.',
      'You want per-field translations and localized URLs with no language cap.',
      'You prefer TypeScript packages to Ruby plugins and container rebuilds.',
      'You want AI features with spending limits per role.',
    ],
    positioning: 'One Platform. Any Community.',
    sources: [
      { label: 'Discourse pricing', url: 'https://www.discourse.org/pricing' },
      {
        label: 'Discourse features',
        url: 'https://www.discourse.org/features',
      },
      { label: 'Discourse AI', url: 'https://www.discourse.org/ai' },
      {
        label: 'Content localization guide',
        url: 'https://meta.discourse.org/t/content-localization-manual-and-automatic-with-discourse-ai/370969',
      },
      {
        label: 'Installing plugins on a self-hosted site',
        url: 'https://meta.discourse.org/t/install-plugins-on-a-self-hosted-site/19157',
      },
      {
        label: 'Passkeys announcement',
        url: 'https://meta.discourse.org/t/passwordless-login-using-passkeys/285589',
      },
      {
        label: 'Import scripts on GitHub',
        url: 'https://github.com/discourse/discourse/tree/main/script/import_scripts',
      },
      {
        label: 'Discourse repository',
        url: 'https://github.com/discourse/discourse',
      },
    ],
    summary:
      'Discourse is a mature open-source discussion platform with deep moderation, bundled AI and a hosted service. VitNode is MIT-licensed TypeScript and treats articles and forum threads as first-class content on one core. Choose Discourse for a proven forum at scale. Choose VitNode when your site is more than discussions.',
    url: 'https://www.discourse.org',
  },
  flarum: {
    advantages: [
      {
        text: 'Flarum gets Google or Discord sign-in and passkeys from third-party extensions. VitNode ships Google, Discord, Facebook, custom OAuth2 and passkeys in its core.',
        title: 'Sign-in and passkeys in core',
      },
      {
        text: 'Flarum lists no first-party AI. VitNode’s AI drafts translations, rewrites text and writes ALT text, with budgets per role and any provider.',
        title: 'AI without extensions',
      },
      {
        text: 'Flarum’s language packs cover the interface, and translating posts needs a third-party extension. VitNode stores a translation per field, with localized URLs and hreflang.',
        title: 'Translations of posts',
      },
      {
        text: 'Flarum’s blog is a community extension in beta. VitNode’s blog plugin has drafts, scheduling, revisions and live co-editing.',
        title: 'A blog that ships',
      },
    ],
    differences: [
      {
        text: 'Flarum keeps its core small on purpose. Sign-in with Google or Discord, two-factor authentication, passkeys, webhooks, warnings and AI all come from Friends of Flarum or other third-party extensions. VitNode ships social sign-in, passkeys, the ModCP, AI and search in its core. Neither has two-factor authentication in core.',
        title: 'What ships in the box',
      },
      {
        text: 'Flarum 2.0 became stable on 9 October 2026. Moving a forum from 1.8 waits until every installed extension has a 2.0 release, and Flarum’s own upgrade guide warns that one straggler can block it. VitNode has its own version of this problem: it is a canary build, and breaking changes between releases are expected.',
        title: 'Stability and upgrades',
      },
      {
        text: 'Flarum translates its interface through language packs, and translating posts needs a third-party extension. A blog extension exists from the community, in beta. VitNode stores a translation per field, gives each language its own URL and ships a blog plugin with scheduling, revisions and live co-editing.',
        title: 'Content and languages',
      },
      {
        text: 'Flarum installs from an archive without SSH and runs on ordinary PHP hosting, with MySQL, MariaDB, PostgreSQL or SQLite. Its realtime extension needs a long-running daemon. VitNode needs Node.js and PostgreSQL, and deploys to Vercel or your own server.',
        title: 'Hosting',
      },
    ],
    facts: {
      hosted: 'No hosting plans listed',
      licence: 'Open source, MIT',
      selfHosted: 'Free',
      stack:
        'PHP 8.3+, Laravel components, Mithril; MySQL, MariaDB, PostgreSQL or SQLite',
    },
    faq: [
      {
        answer:
          'Yes, both are MIT-licensed and free. The differences are the stack (PHP versus TypeScript) and how much ships in core instead of extensions.',
        question: 'Are Flarum and VitNode both free and open source?',
      },
      {
        answer:
          'Not yet. Neither project has an importer for the other, so moving content means a script against Flarum’s database or its JSON:API.',
        question: 'Can VitNode import my Flarum forum?',
      },
      {
        answer:
          'No. VitNode needs Node.js and PostgreSQL, so it suits Vercel, a VPS or a container host rather than classic PHP shared hosting.',
        question: 'Does VitNode run on shared hosting like Flarum?',
      },
    ],
    features: {
      adminInstall: { note: 'Extension Manager', support: 'builtIn' },
      ai: { note: 'Third-party extensions only', support: 'thirdParty' },
      articles: {
        note: 'Community blog extension in beta',
        support: 'thirdParty',
      },
      auditLog: { note: 'Bundled, off by default', support: 'official' },
      contentTranslation: {
        note: 'Interface packs in core, posts via extensions',
        support: 'thirdParty',
      },
      dataExport: { note: 'Bundled GDPR extension', support: 'official' },
      elasticsearch: {
        note: 'Pluggable search drivers since 2.0',
        support: 'thirdParty',
      },
      forums: { note: 'Tags instead of categories', support: 'builtIn' },
      importers: { support: 'thirdParty' },
      passkeys: { support: 'thirdParty' },
      reactions: {
        note: 'Likes bundled, emoji reactions via FoF',
        support: 'official',
      },
      realtime: {
        note: 'Bundled, needs a websocket daemon',
        support: 'official',
      },
      reportsApprovals: {
        note: 'Bundled Flags and Approval',
        support: 'official',
      },
      restApi: { note: 'JSON:API', support: 'builtIn' },
      socialSignIn: { note: 'FoF OAuth', support: 'thirdParty' },
      twoFactor: { support: 'thirdParty' },
      warningsBans: {
        note: 'Suspensions bundled, warnings via FoF',
        support: 'official',
      },
      webhooks: { note: 'FoF Webhooks', support: 'thirdParty' },
    },
    migration:
      'Neither side has an importer for the other. Flarum keeps everything in your SQL database and offers per-member GDPR exports and a JSON:API, so a migration script has what it needs. VitNode is a canary build, so try it on a new project before moving a live forum.',
    pickThem: [
      'You want a simple forum on cheap PHP hosting.',
      'You like installing extensions from the admin panel.',
      'You need private messages, GDPR tools and an audit log today.',
      'You want a stable 2.0 release, not a canary.',
    ],
    pickVitnode: [
      'You want sign-in, moderation, AI and search without stacking extensions.',
      'You publish articles in more than one language.',
      'Your team writes TypeScript or builds with an AI coding agent.',
      'You want an AdminCP with roles, staff permissions and AI budgets.',
    ],
    positioning: 'Forums made simple.',
    sources: [
      { label: 'Flarum homepage', url: 'https://flarum.org/' },
      { label: 'Flarum 2.x docs', url: 'https://docs.flarum.org/2.x/' },
      {
        label: 'Bundled extensions',
        url: 'https://github.com/flarum/framework/tree/2.x/extensions',
      },
      {
        label: 'Flarum 2.0 release announcement',
        url: 'https://discuss.flarum.org/d/40026-flarum-20-is-released-go-upgrade-your-forum',
      },
      {
        label: 'Realtime extension',
        url: 'https://docs.flarum.org/2.x/extensions/realtime',
      },
      {
        label: 'Upgrading extensions to 2.0',
        url: 'https://docs.flarum.org/2.x/extend/update-2_0',
      },
      { label: 'FoF OAuth', url: 'https://packagist.org/packages/fof/oauth' },
      {
        label: 'Flarum repository',
        url: 'https://github.com/flarum/framework',
      },
    ],
    summary:
      'Flarum is a lightweight, MIT-licensed PHP forum that just shipped 2.0. VitNode is MIT-licensed too, but written in TypeScript and built as a fuller community platform: articles, forums, an AdminCP, a ModCP and AI on one core. Pick Flarum for a simple forum on cheap hosting. Pick VitNode when you need more out of the box.',
    url: 'https://flarum.org',
  },
  'invision-community': {
    advantages: [
      {
        text: 'Invision’s docs say its language packs translate the interface, not member content. VitNode stores a translation per field, with localized URLs and hreflang.',
        title: 'Translations of what members write',
      },
      {
        text: 'VitNode costs $0 under MIT. Invision’s self-hosted Classic edition costs $499 plus $199 a year, and its cloud starts at $89 a month billed yearly.',
        title: 'No licence and no renewal',
      },
      {
        text: 'Invision’s REST API and live engagement start on Creator Plus at $149 a month. VitNode’s typed API and WebSocket updates come with every install.',
        title: 'API and realtime on every install',
      },
      {
        text: 'Invision lists AI for spam, moderation and image tagging. VitNode’s AI also drafts translations, rewrites text and writes ALT text, with budgets per role.',
        title: 'AI that writes, not only filters',
      },
    ],
    differences: [
      {
        text: 'Invision Community’s cloud starts at $89 a month billed yearly ($99 monthly), and the REST API, GraphQL and webhooks start on Creator Plus at $149 a month. The self-hosted Classic edition costs $499 once, then $199 a year for updates, and leaves out some newer features such as courses and live topics. VitNode is MIT-licensed and costs $0. You pay only for the server you run it on.',
        title: 'Cost and ownership',
      },
      {
        text: 'Invision’s language packs translate the interface, and its docs say they do not translate what members write. VitNode stores a translation for each field, gives every language its own URL and writes hreflang tags, so an article can really exist in Polish and English.',
        title: 'Content in more than one language',
      },
      {
        text: 'Invision ships apps VitNode does not have: galleries, downloads, events, clubs, courses, commerce with subscriptions and a drag-and-drop page builder. VitNode ships a blog plugin and a forum plugin today. Anything else you build as a plugin on the same core.',
        title: 'Breadth of apps',
      },
      {
        text: 'Invision is PHP, with apps and themes uploaded in its admin panel. Its official marketplace closed in October 2023 and a providers directory replaced it. VitNode is TypeScript. One content type definition gives you a database table, a typed API and AdminCP screens, and the docs are written so an AI coding agent can follow them.',
        title: 'Building on it',
      },
    ],
    facts: {
      hosted: 'From $89/mo billed yearly. API access from $149/mo',
      licence: 'Proprietary. Self-hosted buyers may edit, not redistribute',
      selfHosted: '$499 once, then $199/yr for updates',
      stack: 'PHP and MySQL',
    },
    faq: [
      {
        answer:
          'Yes. VitNode is MIT-licensed and free, and you pay only for your own hosting. It is still a canary build, so today it suits new projects and prototypes better than a busy production community.',
        question: 'Is VitNode a free Invision Community alternative?',
      },
      {
        answer:
          'Not yet. VitNode has no Invision importer, so moving content means writing a migration script against your export or Invision’s REST API.',
        question: 'Can VitNode import my Invision Community?',
      },
      {
        answer:
          'Not yet. VitNode has opt-in passkeys and social sign-in, but no authenticator-app two-factor authentication.',
        question: 'Does VitNode have two-factor authentication?',
      },
    ],
    features: {
      adminInstall: {
        note: 'Upload apps and themes. Official marketplace closed in 2023',
        support: 'builtIn',
      },
      ai: {
        note: 'AI spam protection on all plans, AI moderation on Business',
        support: 'builtIn',
      },
      articles: { note: 'Blogs and Pages apps', support: 'builtIn' },
      auditLog: { support: 'builtIn' },
      contentTranslation: {
        note: 'Language packs translate the interface only',
        support: 'missing',
      },
      dataExport: { note: 'Personal information download', support: 'builtIn' },
      elasticsearch: {
        note: 'Optional self-hosted, Enterprise on cloud',
        support: 'paid',
      },
      forums: { support: 'builtIn' },
      importers: { note: 'Conversion service via sales', support: 'paid' },
      passkeys: { support: 'undocumented' },
      reactions: { support: 'builtIn' },
      realtime: { note: 'Live engagement from Creator Plus', support: 'paid' },
      reportsApprovals: { support: 'builtIn' },
      restApi: { note: 'REST and GraphQL from Creator Plus', support: 'paid' },
      socialSignIn: {
        note: 'Google, Apple, OAuth. Custom SSO on Enterprise',
        support: 'builtIn',
      },
      twoFactor: { support: 'builtIn' },
      warningsBans: { note: 'Warning points that expire', support: 'builtIn' },
      webhooks: { note: 'From Creator Plus', support: 'paid' },
    },
    migration:
      'VitNode has no Invision importer yet. Invision promises cloud customers a free copy of their data when they leave, and Classic installs give you full MySQL access. Moving today means a script against that export or the REST API. If your community is busy and healthy on Invision, stay for now and try VitNode on a new project first.',
    pickThem: [
      'You sell memberships or digital products and want commerce built in.',
      'You want a managed cloud with EU or US hosting and vendor support.',
      'You need galleries, downloads, events or courses today.',
      'You run a large production community and cannot use a canary build.',
    ],
    pickVitnode: [
      'You want an MIT licence with no yearly renewal.',
      'Your content needs real translations, not only a translated interface.',
      'Your team writes TypeScript or builds with an AI coding agent.',
      'You want articles and forum threads on one set of members, roles and search.',
    ],
    positioning: 'Community at our core. Built for so much more.',
    sources: [
      {
        label: 'Invision cloud pricing',
        url: 'https://invisioncommunity.com/buy/',
      },
      {
        label: 'Invision self-hosted pricing',
        url: 'https://invisioncommunity.com/buy/self-hosted/',
      },
      {
        label: 'Invision licence',
        url: 'https://invisioncommunity.com/legal/license',
      },
      {
        label: 'Language packs',
        url: 'https://invisioncommunity.com/docs/visual-design/introducing-language-packs-r265/',
      },
      {
        label: 'Two-factor authentication',
        url: 'https://invisioncommunity.com/docs/89_security-rules/account-security-two-factor-auth-r158/',
      },
      {
        label: 'Warning system',
        url: 'https://invisioncommunity.com/docs/staff-moderation/warning-systems-r156/',
      },
      {
        label: 'Marketplace closure',
        url: 'https://invisioncommunity.com/news/invision-community/marketplace-closure-r1283/',
      },
      {
        label: 'Invision Community 5.0.20 release notes',
        url: 'https://invisioncommunity.com/release-notes-v5/5020-r54/',
      },
    ],
    summary:
      'Invision Community is a mature, paid suite with forums, blogs, galleries, events, commerce and a page builder, sold mostly as a managed cloud. VitNode is free and MIT-licensed, written in TypeScript, and puts articles, forums and per-field translations on one typed core. Invision has years of polish and features VitNode does not, such as two-factor authentication, importers and commerce.',
    url: 'https://invisioncommunity.com',
  },
  nodebb: {
    advantages: [
      {
        text: 'NodeBB’s docs describe no blog or article module. VitNode ships a blog plugin next to the forum, with drafts, scheduling and revisions.',
        title: 'Articles as well as threads',
      },
      {
        text: 'NodeBB translates its interface into about 40 languages, and its docs describe no per-language posts. VitNode stores a translation per field, with localized URLs and hreflang.',
        title: 'Translations of member content',
      },
      {
        text: 'NodeBB documents no built-in AI. VitNode’s AI drafts translations, rewrites text and writes ALT text, with monthly budgets and points per role.',
        title: 'AI with budgets',
      },
      {
        text: 'NodeBB is GPL-3.0. VitNode’s MIT licence lets you build closed-source plugins and products on top of it.',
        title: 'MIT instead of GPL',
      },
    ],
    differences: [
      {
        text: 'NodeBB is the more complete forum today. It has realtime chat, votes, following, flags, a post queue, bans and mutes, web push, two-factor authentication with WebAuthn keys, data export, an events log and ActivityPub federation with Mastodon and others. VitNode’s forum plugin is younger: sections, topics, nested comments and approvals, with no chat, votes or federation.',
        title: 'Forum depth',
      },
      {
        text: 'NodeBB’s docs describe no blog or article module, and its roughly 40 languages cover the interface. VitNode ships a blog plugin next to the forum, stores a translation per field and writes hreflang tags, so the same site can publish articles in several languages.',
        title: 'Content beyond threads',
      },
      {
        text: 'NodeBB is GPL-3.0, which asks that modified versions you distribute stay under the GPL. VitNode is MIT, so you can build closed-source plugins and products on it. Both are free to self-host. NodeBB also sells managed hosting from $20 a month, and VitNode has no managed plan.',
        title: 'Licence and hosting',
      },
      {
        text: 'NodeBB documents no built-in AI and installs plugins from a vetted list in its admin panel. VitNode has AI actions with budgets per role and automatic ALT text, and a Content Engine that turns one definition into a table, a typed API and AdminCP screens. VitNode plugins are packages, not admin-panel installs.',
        title: 'AI and building on it',
      },
    ],
    facts: {
      hosted: 'From $20/mo (Starter, 50k page views)',
      licence: 'Open source, GPL-3.0',
      selfHosted: 'Free',
      stack: 'Node.js 22+; MongoDB, PostgreSQL or Redis',
    },
    faq: [
      {
        answer:
          'Both run on Node.js and both are free to self-host. NodeBB is a mature GPL-3.0 forum. VitNode is an MIT-licensed TypeScript platform where forums are one plugin next to articles.',
        question: 'How is VitNode different from NodeBB?',
      },
      {
        answer:
          'Not yet. VitNode has no NodeBB importer, so moving content means a script against NodeBB’s database or its API.',
        question: 'Can VitNode import my NodeBB forum?',
      },
      {
        answer:
          'No. VitNode has no ActivityPub support today. NodeBB has had it in core since version 4.0.',
        question: 'Does VitNode federate with the fediverse?',
      },
    ],
    features: {
      adminInstall: { note: 'Vetted plugin list', support: 'builtIn' },
      ai: { support: 'undocumented' },
      articles: { support: 'undocumented' },
      auditLog: { note: 'Events log', support: 'builtIn' },
      contentTranslation: {
        note: 'Interface in about 40 languages',
        support: 'undocumented',
      },
      dataExport: { note: 'Profile, posts and uploads', support: 'builtIn' },
      elasticsearch: { note: 'Database search in core', support: 'thirdParty' },
      forums: { support: 'builtIn' },
      importers: { note: 'Community import plugin', support: 'thirdParty' },
      passkeys: {
        note: 'WebAuthn keys as a second factor',
        support: 'official',
      },
      reactions: {
        note: 'Votes in core, reactions plugin',
        support: 'builtIn',
      },
      realtime: { note: 'WebSockets and chat', support: 'builtIn' },
      reportsApprovals: { note: 'Flags and post queue', support: 'builtIn' },
      restApi: { note: 'Read and write APIs', support: 'builtIn' },
      socialSignIn: { note: 'OAuth2 and SSO plugins', support: 'official' },
      twoFactor: { note: 'Bundled 2factor plugin', support: 'official' },
      warningsBans: {
        note: 'Bans and mutes. No warning points documented',
        support: 'builtIn',
      },
      webhooks: { note: 'Official plugin', support: 'official' },
    },
    migration:
      'NodeBB lets members export their profile, posts and uploads, and self-hosters own the database directly. Hosted customers can ask the NodeBB team for an export. VitNode has no NodeBB importer yet, so moving means writing a script.',
    pickThem: [
      'You want a realtime forum with chat today.',
      'You want to join the fediverse through ActivityPub.',
      'You want managed hosting from $20 a month.',
      'You need two-factor authentication, data export and an audit log now.',
    ],
    pickVitnode: [
      'You publish articles as well as threads, in more than one language.',
      'You want an MIT licence for closed-source plugins.',
      'You want AI features with spending limits per role.',
      'You want typed content types that generate their own API and admin screens.',
    ],
    positioning: 'A better forum platform for the modern web.',
    sources: [
      { label: 'NodeBB homepage', url: 'https://nodebb.org/' },
      { label: 'NodeBB pricing', url: 'https://nodebb.org/pricing' },
      { label: 'NodeBB GDPR', url: 'https://nodebb.org/gdpr' },
      {
        label: 'ActivityPub docs',
        url: 'https://docs.nodebb.org/activitypub/',
      },
      {
        label: 'Plugin docs',
        url: 'https://docs.nodebb.org/configuring/plugins/',
      },
      {
        label: 'Search plugins',
        url: 'https://docs.nodebb.org/configuring/plugins/search/',
      },
      {
        label: '2factor plugin',
        url: 'https://github.com/NodeBB/nodebb-plugin-2factor',
      },
      { label: 'NodeBB repository', url: 'https://github.com/NodeBB/NodeBB' },
    ],
    summary:
      'NodeBB is a realtime Node.js forum with ActivityPub federation in core, published hosting plans and a fast release pace. VitNode is MIT-licensed TypeScript and adds articles, per-field translations and AI budgets around the forum. NodeBB is the more complete forum today. VitNode is the broader platform.',
    url: 'https://nodebb.org',
  },
  'wordpress-bbpress': {
    advantages: [
      {
        text: 'bbPress needs separate plugins for a report button, suspensions and social sign-in. VitNode ships a ModCP reports board, an approval queue, social sign-in and passkeys in one core.',
        title: 'Moderation without extra plugins',
      },
      {
        text: 'Translating bbPress topics and replies needs WPML plus a bbPress Multilingual plugin. In VitNode every content type, forum included, stores translations per field.',
        title: 'Forum translations without glue',
      },
      {
        text: 'We found no documented realtime updates for bbPress. VitNode pushes notifications and live co-editing over WebSocket.',
        title: 'Live updates',
      },
      {
        text: 'WordPress 7.0 added an AI client to core, with nothing specific to forums. VitNode’s AI drafts translations, rewrites text and writes ALT text, with budgets per role.',
        title: 'AI for your content',
      },
    ],
    differences: [
      {
        text: 'bbPress keeps the forum simple and leans on the WordPress plugin directory for the rest. A report button, timed suspensions, social sign-in, passkeys and reactions each come from a separate plugin with its own update cycle. VitNode includes a reports board, an approval queue, social sign-in, passkeys, search and notifications in one core, with warnings and bans coming soon.',
        title: 'A stack of plugins, or one core',
      },
      {
        text: 'WPML lists bbPress as compatible, but translating topics and replies needs an extra bbPress Multilingual plugin. In VitNode every content type stores translations per field, with localized URLs and hreflang written for you.',
        title: 'Languages',
      },
      {
        text: 'WordPress has been around since 2003, with thousands of themes and plugins, installs from the admin panel and hosting almost everywhere. bbPress has a built-in importer for phpBB, vBulletin, Invision, MyBB, SMF and more, and it is actively maintained again, with 2.6.20 out in October 2026. VitNode is a canary build with a small ecosystem.',
        title: 'Ecosystem and maturity',
      },
      {
        text: 'WordPress 7.0 added an AI client to core, and user-facing AI features come from a separate plugin. Nothing in it is specific to forums, and we found no documented realtime updates for bbPress. VitNode has live notifications and live co-editing over WebSocket, plus AI actions with budgets per role.',
        title: 'Realtime and AI',
      },
    ],
    facts: {
      hosted: 'WordPress.com plans with plugins from $4/mo billed yearly',
      licence: 'Open source, GPLv2 or later',
      selfHosted: 'Free',
      stack: 'PHP and MySQL or MariaDB',
    },
    faq: [
      {
        answer:
          'Yes. Both are free and open source. VitNode is a single TypeScript core with forums and articles built to share members, moderation and translations. WordPress gets there by combining bbPress with other plugins.',
        question: 'Is VitNode a free bbPress alternative?',
      },
      {
        answer:
          'Not yet. VitNode has no WordPress or bbPress importer, so moving content means a script against a WordPress export or its database.',
        question: 'Can VitNode import a WordPress site with bbPress?',
      },
      {
        answer:
          'No. Forums and articles run inside VitNode itself. If your main site is WordPress and should stay that way, bbPress is the simpler path.',
        question: 'Can I add VitNode to an existing WordPress site?',
      },
    ],
    features: {
      adminInstall: { support: 'builtIn' },
      ai: {
        note: 'AI client in WordPress 7.0, nothing for forums',
        support: 'undocumented',
      },
      articles: { note: 'WordPress posts and pages', support: 'builtIn' },
      auditLog: { note: 'Third-party plugins', support: 'undocumented' },
      contentTranslation: {
        note: 'WPML plus bbPress Multilingual',
        support: 'thirdParty',
      },
      dataExport: {
        note: 'WordPress privacy tools. Forum coverage unconfirmed',
        support: 'builtIn',
      },
      elasticsearch: { note: 'ElasticPress', support: 'thirdParty' },
      forums: { note: 'bbPress plugin', support: 'official' },
      importers: {
        note: 'phpBB, vBulletin, Invision, MyBB, SMF and more',
        support: 'builtIn',
      },
      passkeys: { support: 'thirdParty' },
      reactions: { support: 'thirdParty' },
      realtime: { support: 'undocumented' },
      reportsApprovals: {
        note: 'Pending posts built in, reports via plugins',
        support: 'thirdParty',
      },
      restApi: {
        note: 'WordPress REST API. No bbPress routes documented',
        support: 'undocumented',
      },
      socialSignIn: { support: 'thirdParty' },
      twoFactor: { note: 'Two Factor plugin', support: 'thirdParty' },
      warningsBans: {
        note: 'Blocked role. Warnings and suspensions via plugins',
        support: 'thirdParty',
      },
      webhooks: { support: 'undocumented' },
    },
    migration:
      'WordPress exports posts, pages and custom post types as WXR, and a self-hosted site gives you the full database. VitNode has no importer for WordPress or bbPress yet, so moving means writing a script. If your forum lives inside a healthy WordPress site, keeping it there is a fair choice.',
    pickThem: [
      'Your site already runs on WordPress and the forum is an add-on.',
      'You are moving from phpBB, vBulletin, MyBB or SMF and need an importer.',
      'You want themes and plugins you can install from the admin panel.',
      'You want hosting you can buy almost anywhere for a few dollars.',
    ],
    pickVitnode: [
      'You want members, moderation and translations to work the same everywhere.',
      'You would rather not maintain a stack of forum plugins.',
      'Your team writes TypeScript or builds with an AI coding agent.',
      'You want realtime notifications and AI budgets in core.',
    ],
    positioning: 'Forum software from the creators of WordPress.',
    sources: [
      { label: 'bbPress homepage', url: 'https://bbpress.org/' },
      { label: 'bbPress releases', url: 'https://bbpress.org/blog/' },
      {
        label: 'bbPress user roles',
        url: 'https://codex.bbpress.org/getting-started/before-installing/bbpress-user-roles-and-capabilities/',
      },
      {
        label: 'bbPress importers',
        url: 'https://codex.bbpress.org/getting-started/importing-data/import-forums/',
      },
      { label: 'WPML and bbPress', url: 'https://wpml.org/plugin/bbpress/' },
      { label: 'WordPress.com pricing', url: 'https://wordpress.com/pricing/' },
      {
        label: 'WordPress 7.0 release',
        url: 'https://wordpress.org/news/2026/05/armstrong/',
      },
      {
        label: 'Two Factor plugin',
        url: 'https://wordpress.org/plugins/two-factor/',
      },
    ],
    summary:
      'WordPress with bbPress gives you the largest ecosystem on the web and a forum inside your existing site. VitNode is one TypeScript core where members, roles, moderation, search and translations work the same for articles and forum threads, without a stack of plugins. WordPress wins on ecosystem and importers. VitNode wins on parts that were built to work together.',
    url: 'https://bbpress.org',
  },
  xenforo: {
    advantages: [
      {
        text: 'XenForo’s docs describe translating interface phrases only. VitNode stores a translation per field, with localized URLs and hreflang.',
        title: 'Translations of what members write',
      },
      {
        text: 'We found no AI features on XenForo’s site or in its docs. VitNode’s AI drafts translations, rewrites text and writes ALT text, with budgets per role and any provider.',
        title: 'AI built in',
      },
      {
        text: 'Elasticsearch search is XenForo’s $60 Enhanced Search add-on on self-hosted installs. VitNode includes a free Elasticsearch adapter, with PostgreSQL search by default.',
        title: 'Elasticsearch at no extra cost',
      },
      {
        text: 'VitNode costs $0 under MIT. A self-hosted XenForo licence is $195, then $60 a year for updates, plus paid add-ons.',
        title: 'No licence fee',
      },
    ],
    differences: [
      {
        text: 'A self-hosted XenForo licence costs $195 and keeps working without renewal, and updates cost $60 a year. Enhanced Search ($60), Media Gallery ($70) and Resource Manager ($70) are add-ons with their own yearly extensions, so the full package is $395 up front and $100 a year. XenForo Cloud starts at $54 a month billed yearly and includes the add-ons. VitNode costs $0, plus your hosting.',
        title: 'Cost',
      },
      {
        text: 'XenForo has a polished discussion core: Q&A and suggestion thread types, weighted reactions, warning points that trigger bans, passkeys, two-factor authentication and importers with URL redirects. VitNode’s forum plugin has sections, topics, nested comments and approvals. Warnings, bans, reactions and two-factor authentication are coming soon.',
        title: 'Discussion features',
      },
      {
        text: 'XenForo translates its interface phrases, and its docs say nothing about translating what members write. It can turn a forum into an article repository. VitNode stores a translation per field with localized URLs and hreflang, and its blog plugin adds scheduling, revisions and live co-editing.',
        title: 'Content and languages',
      },
      {
        text: 'We found no AI features on XenForo’s site or in its docs, and Elasticsearch search is the paid Enhanced Search add-on on self-hosted installs. VitNode has AI actions with budgets per role, automatic ALT text and any provider, plus PostgreSQL search by default and a free Elasticsearch adapter.',
        title: 'AI and search',
      },
    ],
    facts: {
      hosted: 'From $54/mo billed yearly (Cloud Starter)',
      licence: 'Proprietary. Source visible to licence holders',
      selfHosted: '$195, then $60/yr for updates. Paid add-ons',
      stack: 'PHP and MySQL',
    },
    faq: [
      {
        answer:
          'Yes. VitNode is MIT-licensed and costs nothing, and you pay only for hosting. It is a canary build, so it suits new projects better than a forum that has to be stable today.',
        question: 'Is VitNode a free XenForo alternative?',
      },
      {
        answer:
          'Not yet. VitNode has no XenForo importer. Moving content means a script against the MySQL database or XenForo’s REST API.',
        question: 'Can VitNode import my XenForo forum?',
      },
      {
        answer:
          'No. VitNode searches with PostgreSQL by default and includes a free Elasticsearch adapter.',
        question: 'Do I pay extra for Elasticsearch in VitNode?',
      },
    ],
    features: {
      adminInstall: { note: 'Zip upload, off by default', support: 'builtIn' },
      ai: { support: 'undocumented' },
      articles: { note: 'Article forums', support: 'builtIn' },
      auditLog: { note: 'Admin and moderator logs', support: 'builtIn' },
      contentTranslation: {
        note: 'Interface phrases only',
        support: 'undocumented',
      },
      dataExport: {
        note: 'Basic profile export reported',
        support: 'undocumented',
      },
      elasticsearch: {
        note: '$60 add-on self-hosted, included on cloud',
        support: 'paid',
      },
      forums: { note: 'Q&A and suggestion threads too', support: 'builtIn' },
      importers: { note: 'Official importer add-on', support: 'official' },
      passkeys: { support: 'builtIn' },
      reactions: { note: 'Weighted reactions', support: 'builtIn' },
      realtime: { support: 'undocumented' },
      reportsApprovals: { support: 'builtIn' },
      restApi: { support: 'builtIn' },
      socialSignIn: {
        note: 'Eight providers and OAuth2 SSO',
        support: 'builtIn',
      },
      twoFactor: { support: 'builtIn' },
      warningsBans: { note: 'Warning points trigger bans', support: 'builtIn' },
      webhooks: { note: 'Since 2.3', support: 'builtIn' },
    },
    migration:
      'VitNode has no XenForo importer yet. Self-hosted XenForo gives full MySQL access, XenForo Cloud offers a complete copy of your data when you cancel, and the REST API covers programmatic export. Moving today means writing a script, so a busy XenForo forum should stay put for now.',
    pickThem: [
      'You want a classic forum on a platform that has run since 2010.',
      'You are moving from vBulletin, phpBB, IPS 4 or SMF and need an importer.',
      'You want a cheap one-off licence on ordinary PHP hosting.',
      'You need two-factor authentication today.',
    ],
    pickVitnode: [
      'You would rather pay nothing and get an MIT licence.',
      'You publish articles as well as threads, in more than one language.',
      'You want AI features with spending limits per role.',
      'Your team writes TypeScript or builds with an AI coding agent.',
    ],
    positioning: 'Compelling Community Platform.',
    sources: [
      { label: 'XenForo Cloud pricing', url: 'https://xenforo.com/purchase/' },
      {
        label: 'XenForo self-hosted pricing',
        url: 'https://xenforo.com/purchase/self-hosted',
      },
      {
        label: 'XenForo licence',
        url: 'https://xenforo.com/license-agreement/',
      },
      {
        label: 'Security features',
        url: 'https://xenforo.com/features/security/',
      },
      {
        label: 'Warnings',
        url: 'https://docs.xenforo.com/manual/users/warnings',
      },
      {
        label: 'Languages',
        url: 'https://docs.xenforo.com/manual/appearance/languages',
      },
      {
        label: 'Enhanced Search',
        url: 'https://docs.xenforo.com/manual/official-addons/enhanced-search',
      },
      {
        label: 'Importers',
        url: 'https://docs.xenforo.com/manual/importing/overview',
      },
    ],
    summary:
      'XenForo is a polished, paid forum platform with a low self-hosted price, strong moderation and a large add-on library. VitNode is free and MIT-licensed, written in TypeScript, and pairs forums with articles and per-field translations on one core. XenForo is the safer pick for a classic forum today. VitNode fits a new project that needs more than threads.',
    url: 'https://xenforo.com',
  },
}

export const COMPETITORS: Competitor[] = COMPARE_SLUGS.map((slug) => ({
  ...COMPETITORS_BY_SLUG[slug],
  name: compareEntry(slug).name,
  slug,
}))

export const findCompetitor = (slug: string) =>
  COMPETITORS.find((item) => item.slug === slug)
