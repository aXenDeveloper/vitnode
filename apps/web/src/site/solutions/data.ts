import type { LucideIcon } from 'lucide-react'

import {
  Bell,
  CalendarClock,
  CalendarDays,
  Crown,
  Eye,
  Gamepad2,
  GitBranch,
  Languages,
  LifeBuoy,
  Megaphone,
  MessageCircleQuestion,
  MessagesSquare,
  Newspaper,
  PenLine,
  Rocket,
  Search,
  Send,
  Trophy,
} from 'lucide-react'

import type { MarketingPageMeta } from '#/site/marketing/metadata'
import type { ScreenKey } from '#/site/marketing/screens'

export type Availability = 'available' | 'plugin' | 'roadmap'

export interface FlowStep {
  Icon: LucideIcon
  text: string
  title: string
}

export interface Tier {
  name: string
  perks: string[]
}

export interface ContentModelType {
  fields: string[]
  name: string
}

export type SolutionSection =
  | {
      after: string[]
      before: string[]
      eyebrow: string
      title: string
      type: 'before-after'
    }
  | {
      bullets: string[]
      illustrative?: boolean
      screen: ScreenKey
      text: string
      title: string
      type: 'feature'
    }
  | {
      description: string
      eyebrow: string
      items: { label: string; status: Availability }[]
      title: string
      type: 'checklist'
    }
  | {
      description: string
      eyebrow: string
      screen: ScreenKey
      tiers: Tier[]
      title: string
      type: 'ladder'
    }
  | {
      description: string
      eyebrow: string
      screens: { caption: string; screen: ScreenKey }[]
      title: string
      type: 'gallery'
    }
  | {
      description: string
      eyebrow: string
      steps: FlowStep[]
      title: string
      type: 'flow'
    }
  | {
      description: string
      eyebrow: string
      title: string
      type: 'model'
      types: ContentModelType[]
    }
  | {
      items: { answer: string; question: string }[]
      title: string
      type: 'faq'
    }

export interface Solution {
  audience: string[]
  description: string
  eyebrow: string
  heroScreen: ScreenKey
  metaDescription: string
  name: string
  sections: SolutionSection[]
  slug: string
  tagline: string
  title: string
}

export const SOLUTIONS: Solution[] = [
  {
    audience: [
      'Product teams',
      'Hardware makers',
      'Agencies',
      'Open-source maintainers',
    ],
    description:
      'Articles, guides and troubleshooting steps as content types, site-wide search on top, and a place for members to ask what the docs missed. Your team writes once, and the answer keeps working long after the ticket would have closed.',
    eyebrow: 'Solution · Help center',
    heroScreen: 'contentEditor',
    metaDescription:
      'Build a help center and knowledge base with VitNode: articles as content types, site-wide search, editor and reviewer roles, real-time updates and SSO. Free and open source.',
    name: 'Help center',
    sections: [
      {
        description:
          'The loop that keeps a help center alive: write it once, let search do the repeating.',
        eyebrow: 'How it works',
        steps: [
          {
            Icon: PenLine,
            text: 'An editor drafts a guide in the Content Engine. Fields, validation and translations are already there.',
            title: 'Write',
          },
          {
            Icon: Send,
            text: 'A reviewer with the right staff permission publishes it. The sitemap and canonical URL update themselves.',
            title: 'Publish',
          },
          {
            Icon: Search,
            text: 'Site-wide search indexes it the same second. Members find it from the search bar or the Discover feed.',
            title: 'Found',
          },
          {
            Icon: MessageCircleQuestion,
            text: 'When a guide misses the mark, members will ask. Model a question as a content type today; threaded discussions are on the roadmap.',
            title: 'Asked',
          },
        ],
        title: 'Write it once. Let search do the repeating.',
        type: 'flow',
      },
      {
        bullets: [
          'Categories, drafts, revisions and scheduled publishing',
          'A language switch on every field',
          'Signed preview links for reviewers without an account',
          'Canonical URLs, slug redirects and a sitemap',
        ],
        screen: 'contentEditor',
        text: 'Describe a “Guide” content type once and this editor appears, with the table, the API and the validation behind it. Nobody waits for a developer to add a field.',
        title: 'An editor your support team actually uses',
        type: 'feature',
      },
      {
        bullets: [
          'Authors, reviewers, publishers and community champions as roles',
          'Per-plugin, per-action staff permissions enforced on the API',
          'Coloured names so readers know who is official',
          'A separate admin session for the control panel',
        ],
        screen: 'roles',
        text: 'Roles decide who drafts, who reviews and who publishes. The API enforces it, the UI reflects it, and nobody writes a custom check.',
        title: 'Editors, reviewers and champions as roles',
        type: 'feature',
      },
      {
        after: [
          'Content types with fields, validation and translations, defined in one file',
          'Search across guides, announcements and every plugin you add',
          'Real-time updates over one WebSocket, on every open tab',
          'Zero licence fees, on your domain, in your database',
        ],
        before: [
          'A docs folder in a repo that only engineers can edit',
          'Answers repeated in chat, email and a wiki nobody searches',
          'A hosted knowledge base billed per agent',
          'No place for members to ask what the docs missed',
        ],
        eyebrow: 'The difference',
        title: 'From a docs folder to a help center',
        type: 'before-after',
      },
      {
        description:
          'Most of the list ships in the canary today. The rest is a plugin you can build now or on the roadmap.',
        eyebrow: 'What a help center needs',
        items: [
          {
            label: 'Guides with categories and translations',
            status: 'available',
          },
          {
            label: 'Site-wide search across every plugin',
            status: 'available',
          },
          {
            label: 'Editor, reviewer and publisher permissions',
            status: 'available',
          },
          {
            label: 'SSO with the accounts your members already have',
            status: 'available',
          },
          { label: 'Transactional email', status: 'available' },
          { label: 'Threaded member questions', status: 'roadmap' },
          { label: 'Sync with your ticketing tool', status: 'plugin' },
          { label: 'Article feedback and analytics', status: 'roadmap' },
        ],
        title: 'Ready today, and what is on the way',
        type: 'checklist',
      },
      {
        description:
          'Two more real screens the people running the help center will open every morning.',
        eyebrow: 'Behind the counter',
        screens: [
          {
            caption:
              'Every service the help center depends on reports its status here: email, search, WebSockets, storage, captcha.',
            screen: 'integrations',
          },
          {
            caption:
              'A dashboard the team lead can rearrange, with widgets contributed by the plugins you install.',
            screen: 'dashboard',
          },
        ],
        title: 'The screens your team will live in',
        type: 'gallery',
      },
      {
        items: [
          {
            answer:
              'Yes. Google, Discord and Facebook adapters ship today, and a custom OAuth2 adapter connects your own product’s accounts so members never see a second password.',
            question: 'Can members sign in with our product’s accounts?',
          },
          {
            answer:
              'Roles gate any content type. Publish one guide to everyone, another to a “Customers” role, and keep internal notes behind staff permissions.',
            question: 'Can some guides stay internal?',
          },
          {
            answer:
              'In your PostgreSQL, on your server or your cloud account. There is no hosted plan and no export fee, because there is nothing to export from.',
            question: 'Where does the content live?',
          },
        ],
        title: 'Questions support leads ask',
        type: 'faq',
      },
    ],
    slug: 'help-center',
    tagline: 'A knowledge base with a community attached.',
    title: 'Answers people find before they ask.',
  },
  {
    audience: [
      'Writers and podcasters',
      'Clubs and associations',
      'Coaches',
      'Niche experts',
    ],
    description:
      'Publish posts, gate them by tier, and keep the member list in your own database. Payments plug in through the provider you already use, and the framework takes nothing off the top.',
    eyebrow: 'Solution · Membership site',
    heroScreen: 'contentEditor',
    metaDescription:
      'Build a membership site with VitNode: posts with the blog plugin, tiers as roles, members-only content, social sign-in and real-time updates, on a domain you own. Open source and free.',
    name: 'Membership site',
    sections: [
      {
        description:
          'Tiers are roles with colours and permissions. Upgrade a member and the doors open instantly, across every plugin.',
        eyebrow: 'Tiers as roles',
        screen: 'roles',
        tiers: [
          {
            name: 'Free',
            perks: [
              'Public posts',
              'Signs in with Google, Discord or Facebook',
            ],
          },
          {
            name: 'Supporter',
            perks: [
              'Members-only posts by role',
              'A coloured name across the site',
            ],
          },
          {
            name: 'Insider',
            perks: [
              'Early drafts and behind the scenes',
              'Private spaces as plugins ship',
            ],
          },
          {
            name: 'Team',
            perks: ['Staff permissions for editors and moderators'],
          },
        ],
        title: 'Free, supporter, insider',
        type: 'ladder',
      },
      {
        bullets: [
          'Articles, categories and authors out of the box',
          'Drafts, revisions and scheduled publishing',
          'Cover images, SEO metadata and an automatic sitemap',
          'A translation for every field if your audience is global',
        ],
        screen: 'contentEditor',
        text: 'The blog plugin ships today. Write in the editor, hit publish, and the sitemap, canonical URLs and social metadata update themselves.',
        title: 'Publishing that feels like writing, not configuring',
        type: 'feature',
      },
      {
        after: [
          'Members in your PostgreSQL, exportable any time',
          'Real-time updates reach every open tab through one WebSocket',
          'Zero licence fees; you keep whatever your billing provider leaves',
          'Posts, members and conversations under one domain',
        ],
        before: [
          'The platform owns the email list',
          'Reach depends on this month’s algorithm',
          'A cut of every subscription, forever',
          'Comments and community live somewhere else',
        ],
        eyebrow: 'Platform vs home',
        title: 'What changes when the list is yours',
        type: 'before-after',
      },
      {
        description:
          'Payments are the honest gap: VitNode has no billing built in. Connect Stripe or your provider through a plugin and map subscriptions to roles.',
        eyebrow: 'What a membership site needs',
        items: [
          { label: 'Posts with SEO and sitemap', status: 'available' },
          { label: 'Members-only content by role', status: 'available' },
          { label: 'Social sign-in for members', status: 'available' },
          {
            label: 'Live toasts through the WebSocket channel',
            status: 'available',
          },
          {
            label: 'Search across everything you published',
            status: 'available',
          },
          { label: 'Payments and subscriptions', status: 'plugin' },
          { label: 'Podcast RSS feeds', status: 'plugin' },
          { label: 'Comments and discussions', status: 'roadmap' },
        ],
        title: 'Ready today, and what is on the way',
        type: 'checklist',
      },
      {
        description: 'The member side and your side, both ready.',
        eyebrow: 'Two sides of the same site',
        screens: [
          {
            caption:
              'Members sign in with Google, Discord or Facebook. Registration and password reset come ready.',
            screen: 'login',
          },
          {
            caption:
              'Your control room: members, roles, posts and a dashboard with widgets from the plugins you add.',
            screen: 'dashboard',
          },
        ],
        title: 'Members and you',
        type: 'gallery',
      },
      {
        items: [
          {
            answer:
              'Not out of the box. Connect Stripe or your provider through a plugin that assigns a role on payment. Roles then gate the content. The framework itself takes no cut.',
            question: 'Can I charge for tiers?',
          },
          {
            answer:
              'Yes. Every content type has a typed CRUD API, so a short script can import posts from your old platform, images included through the storage adapter.',
            question: 'Can I import my existing posts?',
          },
          {
            answer:
              'Some. Setup is a few commands, the docs are written for a first-timer, and the repository is built for AI coding agents if you want help with the plugin part.',
            question: 'Do I need a developer?',
          },
        ],
        title: 'Questions creators ask',
        type: 'faq',
      },
    ],
    slug: 'membership-site',
    tagline: 'Tiers as roles, content behind a door you control.',
    title: 'Members-only, without the middleman.',
  },
  {
    audience: [
      'Maintainers',
      'Dev-tool startups',
      'Foundations',
      'Meetup organisers',
    ],
    description:
      'Release notes, guides and community updates as content types, contributors and maintainers as roles, Discord sign-in today and your own OAuth2 provider tomorrow. Plus docs your users’ AI agents can read too.',
    eyebrow: 'Solution · Open-source project hub',
    heroScreen: 'dashboard',
    metaDescription:
      'Build a home for your open-source project with VitNode: release notes and guides as content types, contributor roles, Discord and OAuth2 sign-in, real-time updates and agent-readable docs. Free and MIT-licensed.',
    name: 'Open-source hub',
    sections: [
      {
        description:
          'Each type is one TypeScript definition in your plugin. The Content Engine generates the table, validation, API and admin screens.',
        eyebrow: 'Your project as content types',
        title: 'Release notes, guides, showcases and RFCs',
        type: 'model',
        types: [
          {
            fields: [
              'version',
              'summary',
              'body (rich text)',
              'breaking changes',
              'published at',
            ],
            name: 'Release note',
          },
          {
            fields: [
              'title',
              'body (rich text)',
              'difficulty',
              'author → role',
            ],
            name: 'Guide',
          },
          {
            fields: [
              'project name',
              'link',
              'screenshot',
              'submitted by → member',
            ],
            name: 'Showcase',
          },
          {
            fields: [
              'title',
              'status',
              'body (rich text)',
              'decision',
              'discussion → relation',
            ],
            name: 'RFC',
          },
        ],
      },
      {
        description:
          'Contribution is a ladder. Roles carry the colour, the permissions and the spaces each level can enter.',
        eyebrow: 'Contributors as roles',
        screen: 'roles',
        tiers: [
          {
            name: 'User',
            perks: ['Reads guides and release notes', 'Signs in with Discord'],
          },
          {
            name: 'Contributor',
            perks: [
              'A coloured name across the site',
              'Drafts guides for review',
            ],
          },
          {
            name: 'Maintainer',
            perks: ['Publishes release notes', 'Staff permissions per plugin'],
          },
          { name: 'Core team', perks: ['Everything, including the AdminCP'] },
        ],
        title: 'User, contributor, maintainer, core',
        type: 'ladder',
      },
      {
        bullets: [
          'Discord sign-in ships today',
          'GitHub or any other provider through the custom OAuth2 adapter',
          'Captcha and rate limits on the sign-up form',
          'HttpOnly sessions with hashed tokens',
        ],
        screen: 'login',
        text: 'Your users already have accounts everywhere. Let them in with Discord today, wire your own OAuth2 provider tomorrow, and keep the sign-up form boring for bots.',
        title: 'Sign in with the account they already have',
        type: 'feature',
      },
      {
        description:
          'What shipping a version looks like when the hub is part of the workflow.',
        eyebrow: 'Release day',
        steps: [
          {
            Icon: PenLine,
            text: 'A maintainer drafts the release note as a content type, with breaking changes as a field, not a paragraph.',
            title: 'Draft the notes',
          },
          {
            Icon: Rocket,
            text: 'Publish. The sitemap, canonical URL and social metadata update; search indexes it instantly.',
            title: 'Publish',
          },
          {
            Icon: Bell,
            text: 'An event listener in your plugin pushes a live toast to every open tab over the WebSocket core ships. Email goes out through the adapter you chose.',
            title: 'Notify',
          },
          {
            Icon: MessagesSquare,
            text: 'Feedback needs a place to land. Point people at GitHub Discussions or Discord today; threaded discussions here are on the roadmap.',
            title: 'Discuss',
          },
        ],
        title: 'From draft to “it shipped” without leaving the hub',
        type: 'flow',
      },
      {
        description:
          'The honest list for a project hub. Most is here; discussions are on the roadmap.',
        eyebrow: 'What a project hub needs',
        items: [
          {
            label: 'Release notes, guides and showcases as content types',
            status: 'available',
          },
          {
            label: 'Contributor roles and staff permissions',
            status: 'available',
          },
          {
            label: 'Discord sign-in, OAuth2 for the rest',
            status: 'available',
          },
          {
            label: 'OpenAPI docs generated from your routes',
            status: 'available',
          },
          {
            label: 'Live toasts through the WebSocket channel',
            status: 'available',
          },
          { label: 'Threaded discussions and Q&A', status: 'roadmap' },
          { label: 'GitHub release and issue sync', status: 'plugin' },
          { label: 'Sponsor tiers as roles', status: 'plugin' },
        ],
        title: 'Ready today, and what is on the way',
        type: 'checklist',
      },
      {
        description: 'What the maintainers see.',
        eyebrow: 'For the maintainers',
        screens: [
          {
            caption:
              'Email, storage, search and WebSockets report their status in one place, with test buttons.',
            screen: 'integrations',
          },
          {
            caption:
              'Release notes and guides get generated editors with per-field translations.',
            screen: 'contentEditor',
          },
        ],
        title: 'The maintainer view',
        type: 'gallery',
      },
      {
        items: [
          {
            answer:
              'The framework ships an AGENTS.md and an llms-full.txt for its own docs, and every API route you add is documented in OpenAPI at /api/swagger. Publishing an llms.txt for your own project is a small plugin.',
            question: 'Can AI agents read the hub?',
          },
          {
            answer:
              'Discord ships as an adapter. GitHub and others connect through the custom OAuth2 adapter documented in the SSO section.',
            question: 'Is there GitHub sign-in?',
          },
          {
            answer:
              'Yes. One Node.js process, one PostgreSQL. Redis is optional. It runs fine on a small VPS or your existing cloud account.',
            question: 'Can we run it on a small VPS?',
          },
        ],
        title: 'Questions maintainers ask',
        type: 'faq',
      },
    ],
    slug: 'open-source-hub',
    tagline: 'Announcements, contributors and docs in one place.',
    title: 'A home for your project that is not an issue tracker.',
  },
  {
    audience: [
      'Guilds and clans',
      'Esports teams',
      'Modding communities',
      'LAN organisers',
    ],
    description:
      'A home base for clans, guilds and esports teams: members sign in with Discord, roles mirror your ranks, announcements go out live to every open tab, and the roster stops living in a spreadsheet.',
    eyebrow: 'Solution · Gaming guild hub',
    heroScreen: 'login',
    metaDescription:
      'Build a guild or clan hub with VitNode: Discord sign-in, ranks as roles, announcements with real-time updates, events as a plugin and a multilingual roster. Free and open source.',
    name: 'Gaming guild hub',
    sections: [
      {
        bullets: [
          'Discord sign-in ships as an adapter',
          'Google and Facebook too, for the parents-approved crowd',
          'Captcha and rate limits keep bots off the recruit form',
          'Device sessions members can review and revoke',
        ],
        screen: 'login',
        text: 'Your members already live on Discord. Let them sign in with it and skip the “I forgot my password” DMs forever.',
        title: 'Sign in with Discord. Done.',
        type: 'feature',
      },
      {
        description:
          'Ranks are roles with colours and permissions. Promote someone and every plugin notices, from the coloured name to the private spaces.',
        eyebrow: 'Ranks as roles',
        screen: 'roles',
        tiers: [
          {
            name: 'Recruit',
            perks: ['Reads announcements', 'Applies to the roster'],
          },
          {
            name: 'Member',
            perks: [
              'Roster and members-only news',
              'Signs up for events once the plugin exists',
            ],
          },
          {
            name: 'Officer',
            perks: ['Posts announcements', 'Approves recruits by role'],
          },
          {
            name: 'Guild master',
            perks: ['Staff permissions across every plugin'],
          },
        ],
        title: 'Recruit, member, officer, guild master',
        type: 'ladder',
      },
      {
        description:
          'What a raid night looks like when the hub does the nagging.',
        eyebrow: 'Raid night',
        steps: [
          {
            Icon: Megaphone,
            text: 'An officer posts the plan as an announcement. Members-only, by role.',
            title: 'Announce',
          },
          {
            Icon: CalendarDays,
            text: 'Sign-ups run through an events plugin with RSVPs. Roles decide who can see which event.',
            title: 'Sign up',
          },
          {
            Icon: Bell,
            text: 'Thirty minutes before, the events plugin pushes a live toast over the WebSocket core already ships. No refresh, no pinned message.',
            title: 'Get pinged',
          },
          {
            Icon: Trophy,
            text: 'Post the recap with screenshots through the storage adapter. Search finds it next time someone asks.',
            title: 'Recap',
          },
        ],
        title: 'Announce, sign up, get pinged, recap',
        type: 'flow',
      },
      {
        after: [
          'A roster with roles, coloured names and a history that stays put',
          'Announcements members can search, not scroll for',
          'Real-time updates on every open tab, not just the one with Discord open',
          'Your domain, your data, no per-member pricing',
        ],
        before: [
          'The roster is a spreadsheet three officers can edit',
          'Announcements vanish above the scroll in an hour',
          'Rank changes mean editing permissions in four places',
          'The guild’s history lives in someone’s screenshots folder',
        ],
        eyebrow: 'Discord-only vs a real home',
        title: 'Keep Discord for the voice. Give the guild a home.',
        type: 'before-after',
      },
      {
        description:
          'Events and leaderboards are the plugins people build first for a guild hub.',
        eyebrow: 'What a guild hub needs',
        items: [
          { label: 'Discord sign-in', status: 'available' },
          {
            label: 'Ranks as roles with colours and permissions',
            status: 'available',
          },
          {
            label: 'Announcements as a members-only content type',
            status: 'available',
          },
          {
            label: 'Multilingual interface for international guilds',
            status: 'available',
          },
          {
            label: 'Screenshots and media through storage adapters',
            status: 'available',
          },
          { label: 'Events with RSVPs and live reminders', status: 'plugin' },
          { label: 'Leaderboards and stats', status: 'plugin' },
          { label: 'Recruitment and discussion threads', status: 'roadmap' },
        ],
        title: 'Ready today, and what is on the way',
        type: 'checklist',
      },
      {
        description: 'What the officers see.',
        eyebrow: 'For the officers',
        screens: [
          {
            caption:
              'Members, roles and announcements in one Admin Control Panel with widgets your plugins add.',
            screen: 'dashboard',
          },
          {
            caption:
              'WebSockets, email and storage report their status and can be tested in place.',
            screen: 'integrations',
          },
        ],
        title: 'The officers’ table',
        type: 'gallery',
      },
      {
        items: [
          {
            answer:
              'Sign-in and profile data come from Discord today. Syncing Discord roles both ways is a plugin, and the events and webhooks are there to build it.',
            question: 'Can it sync with our Discord roles?',
          },
          {
            answer:
              'Yes. Every screen and content field can speak your members’ language. Add a locale with one command.',
            question: 'Our guild speaks three languages. Does it?',
          },
          {
            answer:
              'A small VPS or a free-tier cloud account with a managed PostgreSQL. The software is free at any roster size.',
            question: 'What does it cost to run for a 200-member guild?',
          },
        ],
        title: 'Questions officers ask',
        type: 'faq',
      },
    ],
    slug: 'gaming-guild',
    tagline: 'Roster, events and news, with Discord sign-in built in.',
    title: 'Your guild deserves more than a pinned message.',
  },
  {
    audience: [
      'Magazines and newsrooms',
      'Company blogs',
      'NGOs',
      'Multi-market brands',
    ],
    description:
      'Articles with drafts, revisions, scheduling and a translation for every field. Canonical URLs, hreflang and the sitemap handle themselves, and authors, translators and editors each get exactly the permissions they need.',
    eyebrow: 'Solution · Multilingual magazine',
    heroScreen: 'contentEditor',
    metaDescription:
      'Run a multilingual magazine with VitNode: articles with per-field translations, editorial roles, scheduled publishing, hreflang and sitemap generated, and search across every language. Free and open source.',
    name: 'Multilingual magazine',
    sections: [
      {
        description: 'One newsroom, every market, no copy-paste between sites.',
        eyebrow: 'From draft to every market',
        steps: [
          {
            Icon: PenLine,
            text: 'An author drafts the article in the base language. Drafts are private until a role says otherwise.',
            title: 'Draft',
          },
          {
            Icon: Eye,
            text: 'An editor reviews with a signed preview link. Revisions keep the previous version one click away.',
            title: 'Review',
          },
          {
            Icon: Languages,
            text: 'Translators fill the same fields in their language. Every field has its own switch; nothing is duplicated.',
            title: 'Translate',
          },
          {
            Icon: CalendarClock,
            text: 'Schedule the publish. Hreflang alternates and the sitemap entries update for every language at once.',
            title: 'Schedule',
          },
        ],
        title: 'Draft, review, translate, schedule',
        type: 'flow',
      },
      {
        bullets: [
          'A language switch on every field, including alt text and slugs',
          'Drafts, revisions and scheduled publishing',
          'Cover images through S3, R2 or Supabase, optimised to WebP',
          'Slug history, hreflang alternates and sitemap entries',
        ],
        screen: 'contentEditor',
        text: 'This is the article editor the blog plugin ships with. Each field carries its own language selector, so a translator works next to the original instead of in a copy.',
        title: 'Translate field by field, not site by site',
        type: 'feature',
      },
      {
        description:
          'A newsroom is roles all the way down. Each one is a role with staff permissions scoped to the content it touches.',
        eyebrow: 'The newsroom as roles',
        screen: 'roles',
        tiers: [
          { name: 'Author', perks: ['Drafts and edits their own articles'] },
          { name: 'Translator', perks: ['Edits translated fields only'] },
          {
            name: 'Editor',
            perks: ['Reviews drafts', 'Publishes and schedules'],
          },
          {
            name: 'Publisher',
            perks: ['Categories, authors and settings', 'The AdminCP'],
          },
        ],
        title: 'Author, translator, editor, publisher',
        type: 'ladder',
      },
      {
        description:
          'Everything editorial ships today. AI translation drafts are a plugin on top of the built-in AI blocks.',
        eyebrow: 'What a newsroom needs',
        items: [
          {
            label: 'Per-field translations with hreflang alternates',
            status: 'available',
          },
          {
            label: 'Drafts, revisions and scheduled publishing',
            status: 'available',
          },
          {
            label: 'Author, translator and editor permissions',
            status: 'available',
          },
          {
            label: 'Cover images with automatic WebP optimisation',
            status: 'available',
          },
          { label: 'Search with language-aware ranking', status: 'available' },
          {
            label: 'Reader alerts, live and by email',
            status: 'roadmap',
          },
          { label: 'AI-assisted translation drafts', status: 'plugin' },
          { label: 'Reader comments', status: 'roadmap' },
        ],
        title: 'Ready today, and what is on the way',
        type: 'checklist',
      },
      {
        description: 'What the editorial desk sees.',
        eyebrow: 'For the desk',
        screens: [
          {
            caption:
              'Articles, categories, authors and members in one Admin Control Panel.',
            screen: 'dashboard',
          },
          {
            caption:
              'Storage for images, email for subscribers and AI for translation drafts, each reporting its status.',
            screen: 'integrations',
          },
        ],
        title: 'The editorial desk',
        type: 'gallery',
      },
      {
        items: [
          {
            answer:
              'Yes. Each article has one canonical URL per language, hreflang tags between them and a sitemap that lists every version.',
            question: 'Does every language get its own URL and hreflang?',
          },
          {
            answer:
              'Not out of the box, but the AI building blocks are. A small plugin can draft a translation with your provider and leave the translator to approve it.',
            question: 'Can AI draft translations?',
          },
          {
            answer:
              'Every content type has a typed CRUD API, so an import script for your old CMS is an afternoon, images included.',
            question: 'Can we import from our current CMS?',
          },
        ],
        title: 'Questions editors ask',
        type: 'faq',
      },
    ],
    slug: 'multilingual-magazine',
    tagline: 'An editorial workflow with translations built in.',
    title: 'One newsroom. Every language your readers speak.',
  },
]

export const SOLUTION_ICONS: Record<string, LucideIcon> = {
  'gaming-guild': Gamepad2,
  'help-center': LifeBuoy,
  'membership-site': Crown,
  'multilingual-magazine': Newspaper,
  'open-source-hub': GitBranch,
}

export const findSolution = (slug: string) =>
  SOLUTIONS.find((solution) => solution.slug === slug)

export const solutionPath = (slug: string) => `/solutions/${slug}`

export const solutionPageMeta = (solution: Solution): MarketingPageMeta => ({
  breadcrumbs: [
    { name: 'Solutions', path: '/solutions' },
    { name: solution.name, path: solutionPath(solution.slug) },
  ],
  description: solution.metaDescription,
  path: solutionPath(solution.slug),
  title: `${solution.name} - Solutions`,
})
