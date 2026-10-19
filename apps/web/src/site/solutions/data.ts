import type { LucideIcon } from 'lucide-react'

import {
  AppWindow,
  Bell,
  Boxes,
  Braces,
  CalendarClock,
  CalendarDays,
  Crown,
  Eye,
  Flag,
  Gamepad2,
  GitBranch,
  Inbox,
  Languages,
  LifeBuoy,
  ListChecks,
  Megaphone,
  MessageCircleQuestion,
  MessageSquarePlus,
  MessagesSquare,
  Newspaper,
  NotebookPen,
  Package,
  PenLine,
  Rocket,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Timer,
  Trophy,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react'

import type { ScreenKey } from '@/site/marketing/screens'

import { solutionEntry } from './catalog'

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
    ...solutionEntry('help-center'),
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
    tagline: 'A knowledge base with a community attached.',
    title: 'Answers people find before they ask.',
  },
  {
    ...solutionEntry('membership-site'),
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
    tagline: 'Tiers as roles, content behind a door you control.',
    title: 'Members-only, without the middleman.',
  },
  {
    ...solutionEntry('open-source-hub'),
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
    tagline: 'Announcements, contributors and docs in one place.',
    title: 'A home for your project that is not an issue tracker.',
  },
  {
    ...solutionEntry('gaming-guild'),
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
    tagline: 'Roster, events and news, with Discord sign-in built in.',
    title: 'Your guild deserves more than a pinned message.',
  },
  {
    ...solutionEntry('multilingual-magazine'),
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
    tagline: 'An editorial workflow with translations built in.',
    title: 'One newsroom. Every language your readers speak.',
  },
  {
    ...solutionEntry('blog'),
    audience: [
      'Indie writers',
      'Company blogs',
      'Developer advocates',
      'Small editorial teams',
    ],
    description:
      'The blog plugin gives every post a rich editor, categories, revisions and scheduled publishing. An SEO checklist reads over your shoulder, AI drafts the excerpt and the translation, and a co-author can type in the same post at the same time.',
    eyebrow: 'Solution · Blog',
    heroScreen: 'contentEditor',
    sections: [
      {
        description:
          'What happens between the first sentence and the post going live.',
        eyebrow: 'A post’s day',
        steps: [
          {
            Icon: PenLine,
            text: 'Write in the editor. Revisions keep the earlier versions, so yesterday’s better paragraph is a diff and a restore away.',
            title: 'Draft',
          },
          {
            Icon: Users,
            text: 'Invite a co-author into the same post. You see their name on the field they are typing in, and the draft saves for both of you.',
            title: 'Co-edit',
          },
          {
            Icon: ListChecks,
            text: 'The SEO checklist looks at the title, excerpt, URL, cover image and its alt text, and tells you what is left before you publish.',
            title: 'Check',
          },
          {
            Icon: CalendarClock,
            text: 'Publish now or pick a date. The sitemap, canonical URL and social metadata update with the post.',
            title: 'Schedule',
          },
        ],
        title: 'Draft, co-edit, check, schedule',
        type: 'flow',
      },
      {
        bullets: [
          'Categories, several authors per post and cover images',
          'Drafts, revisions with a diff and restore, signed preview links',
          'A translation on every field, slugs included, with hreflang',
          'Images through local disk, S3, R2 or Supabase, optimised to WebP',
        ],
        screen: 'contentEditor',
        text: 'This is the article editor the blog plugin ships with. Each field has its own language switch, so the Polish version sits next to the English one instead of in a copy that slowly drifts away from it.',
        title: 'The editor you will actually write in',
        type: 'feature',
      },
      {
        bullets: [
          'Translate a post into another language as a draft you review',
          'Draft the excerpt from the body when you are out of words',
          'Ask for a review of the post before it goes out',
          'Any provider through the Vercel AI SDK, with points per role and a monthly budget',
        ],
        screen: 'integrations',
        text: 'Three AI actions ship in the blog editor. You pick the provider and the model, the AdminCP keeps the history, and a budget stops the bill from surprising anyone.',
        title: 'AI helpers with a spending limit',
        type: 'feature',
      },
      {
        after: [
          'Co-authors in the same post, with names on the fields they edit',
          'Revisions, scheduling and an SEO checklist in the editor itself',
          'One post with a translation on each field and hreflang between them',
          'An AI-drafted excerpt you can keep, edit or throw away',
        ],
        before: [
          'A draft passed around as a shared doc, then pasted in by hand',
          'A plugin for SEO, another for translations, a third for backups',
          'Translations kept as separate posts that drift apart',
          'An excerpt written at midnight because the post needs one',
        ],
        eyebrow: 'The difference',
        title: 'From a stack of plugins to one editor',
        type: 'before-after',
      },
      {
        description:
          'The writing side ships today. The reader side is still growing, and here is exactly where it stands.',
        eyebrow: 'What a blog needs',
        items: [
          {
            label: 'Posts with categories, revisions and scheduling',
            status: 'available',
          },
          {
            label: 'Per-field translations with hreflang and sitemap',
            status: 'available',
          },
          { label: 'SEO checklist before you publish', status: 'available' },
          {
            label: 'AI translate, excerpt and review actions',
            status: 'available',
          },
          {
            label: 'Live co-editing with a shared draft',
            status: 'available',
          },
          {
            label: 'Posts in site search and the Discover feed',
            status: 'available',
          },
          { label: 'A blog index page listing every post', status: 'roadmap' },
          { label: 'Reader comments', status: 'roadmap' },
          { label: 'RSS feed and newsletter emails', status: 'plugin' },
        ],
        title: 'Ready today, and what is on the way',
        type: 'checklist',
      },
      {
        items: [
          {
            answer:
              'Yes. Live co-editing shows who is in the post and which field they are typing in, and everyone shares one autosaved draft.',
            question: 'Can two people edit the same post?',
          },
          {
            answer:
              'Any provider the Vercel AI SDK supports. Each action gets its own model, roles get monthly points, and the site gets a budget in dollars.',
            question: 'Which AI provider does it use?',
          },
          {
            answer:
              'Not yet. The plugin ships the article page and the admin side today; a page that lists every post and reader comments are on the roadmap. Until then, posts show up in search and the Discover feed.',
            question: 'Is there a post list and comments?',
          },
          {
            answer:
              'There is no importer yet. Every content type has a typed API, so a short script, or your AI coding agent, can move posts over with their images.',
            question: 'Can I bring posts from my old blog?',
          },
        ],
        title: 'Questions writers ask',
        type: 'faq',
      },
    ],
    tagline: 'Posts, translations and AI helpers in the editor you write in.',
    title: 'Hit publish with the SEO already checked.',
  },
  {
    ...solutionEntry('forum'),
    audience: [
      'Hobby communities',
      'Product forums',
      'Support communities',
      'Owners of long-running forums',
    ],
    description:
      'The forum plugin gives you a tree of sections, topics with nested comments and permalinks, and approval rules per section. Moderators get a ModCP with a reports board, scoped to the sections they look after.',
    eyebrow: 'Solution · Forum',
    heroScreen: 'roles',
    sections: [
      {
        description:
          'The forum is built on the Content Engine, so topics and comments get revisions, reports, search and SEO the same way articles do.',
        eyebrow: 'How the forum is put together',
        title: 'Sections, topics and comments',
        type: 'model',
        types: [
          {
            fields: [
              'name',
              'description',
              'icon',
              'parent section (up to four levels)',
              'approval policy',
            ],
            name: 'Section',
          },
          {
            fields: [
              'title',
              'slug',
              'body (rich text)',
              'author → member',
              'section → container',
            ],
            name: 'Topic',
          },
          {
            fields: [
              'body (rich text)',
              'author → member',
              'topic → relation',
              'reply to → comment',
            ],
            name: 'Comment',
          },
        ],
      },
      {
        description:
          'From the first post to the report somebody files three replies later.',
        eyebrow: 'A thread’s life',
        steps: [
          {
            Icon: MessageSquarePlus,
            text: 'A member starts a topic in a section. Edits keep revisions, so a moderator can see what the post said before.',
            title: 'Post',
          },
          {
            Icon: ShieldCheck,
            text: 'If the section asks for approval, the topic waits in the approvals queue and the author sees it under their pending posts.',
            title: 'Approve',
          },
          {
            Icon: MessagesSquare,
            text: 'Replies nest under the comment they answer. Every comment has a permalink, so “see my reply above” becomes a link.',
            title: 'Reply',
          },
          {
            Icon: Flag,
            text: 'Someone reports a post. It lands on the ModCP board, a moderator claims it, hides the post if needed and resolves the report.',
            title: 'Report',
          },
        ],
        title: 'Post, approve, reply, report',
        type: 'flow',
      },
      {
        bullets: [
          'Moderator grants scoped to the sections a moderator looks after',
          'A reports board with New, In progress and Done columns',
          'Claims, internal notes and an activity timeline on each report',
          'Hide a post without deleting it, and bring it back later',
        ],
        screen: 'roles',
        text: 'The person who knows the hardware section best can moderate the hardware section, and nothing else. Permissions are checked on the API, so the buttons and the rules always agree.',
        title: 'Moderators for the sections they know',
        type: 'feature',
      },
      {
        after: [
          'MIT licence, free at any number of members',
          'A TypeScript plugin system with a typed API',
          'Moderators scoped to the sections they look after',
          'A reports board with claims, notes and a history',
        ],
        before: [
          'A licence renewal every year to keep the updates coming',
          'A PHP codebase nobody on the team wants to extend',
          'Moderators who see every section or none',
          'Reports piling up in a private thread called “Mod queue”',
        ],
        eyebrow: 'Old suite vs VitNode',
        title: 'The forum you know, on a stack you can extend',
        type: 'before-after',
      },
      {
        description:
          'Discussion and moderation basics ship today. Member penalties and a few social features are on the roadmap.',
        eyebrow: 'What a forum needs',
        items: [
          { label: 'Section tree up to four levels deep', status: 'available' },
          {
            label: 'Topics and nested comments with permalinks',
            status: 'available',
          },
          {
            label: 'Approval for new posts and edits, per section',
            status: 'available',
          },
          { label: 'Reports board in the ModCP', status: 'available' },
          { label: 'Moderator permissions per section', status: 'available' },
          {
            label: 'Search across topics and comments',
            status: 'available',
          },
          { label: 'Warnings, mutes and bans', status: 'roadmap' },
          { label: 'Reactions and reply notifications', status: 'roadmap' },
          { label: 'Importers from other forum software', status: 'roadmap' },
        ],
        title: 'Ready today, and what is on the way',
        type: 'checklist',
      },
      {
        items: [
          {
            answer:
              'Not yet. Importers are on the roadmap. The forum’s typed API means a developer, or an AI coding agent, can write a one-off migration script in the meantime.',
            question: 'Can I move my forum from another software?',
          },
          {
            answer:
              'Yes. Moderator grants are scoped per section, so a moderator sees reports and approvals only where they have a say.',
            question: 'Can a moderator look after just one section?',
          },
          {
            answer:
              'Captcha and rate limits guard sign-up, a section can hold new posts for approval, and members can file up to 20 reports an hour each.',
            question: 'What about spam?',
          },
          {
            answer:
              'The notifications inbox and email digests ship in the core, but the forum does not send reply notifications yet. They are on the roadmap.',
            question: 'Do members get notified about replies?',
          },
        ],
        title: 'Questions forum owners ask',
        type: 'faq',
      },
    ],
    tagline: 'Sections, topics and nested comments, with a ModCP built in.',
    title: 'A forum where moderation keeps up.',
  },
  {
    ...solutionEntry('community'),
    audience: [
      'Fan communities',
      'Creator communities',
      'Professional networks',
      'Local groups',
    ],
    description:
      'Publish with the blog plugin, talk in the forum, and keep one member account across both. Search, the Discover feed, notifications and the ModCP cover everything, so the site feels like one place instead of three tabs.',
    eyebrow: 'Solution · Community site',
    heroScreen: 'dashboard',
    sections: [
      {
        after: [
          'One account across articles, topics and settings',
          'One ⌘K search across posts, topics and comments',
          'One ModCP for reports and approvals',
          'One AdminCP for members, roles and plugins',
        ],
        before: [
          'A CMS for articles, forum software for talk, a chat app for the rest',
          'Three logins and three member lists that never match',
          'Moderation spread across plugins and bots',
          'Search that only knows about one of them',
        ],
        eyebrow: 'Stitched together vs one site',
        title: 'Three tools, or one community',
        type: 'before-after',
      },
      {
        description: 'What joining feels like on the member’s side.',
        eyebrow: 'A member’s first week',
        steps: [
          {
            Icon: UserPlus,
            text: 'Sign up with email, Google, Discord or Facebook. Turn passkeys on and nobody has to remember a password.',
            title: 'Join',
          },
          {
            Icon: UserRound,
            text: 'Add an avatar and a cover. Their profile page keeps an activity timeline from day one.',
            title: 'Settle in',
          },
          {
            Icon: Search,
            text: '⌘K suggests posts and topics while they type, and the Discover feed shows what is new.',
            title: 'Look around',
          },
          {
            Icon: MessagesSquare,
            text: 'They start a topic in the forum, reply in nested comments and report what does not belong.',
            title: 'Join in',
          },
        ],
        title: 'Join, settle in, look around, join in',
        type: 'flow',
      },
      {
        description:
          'Roles carry a colour, a prefix, upload limits and AI points. A member can hold one primary role and several secondary ones.',
        eyebrow: 'Members as roles',
        screen: 'roles',
        tiers: [
          {
            name: 'Member',
            perks: [
              'Posts topics and comments',
              'Profile with avatar and cover',
            ],
          },
          {
            name: 'Regular',
            perks: [
              'A coloured name and prefix',
              'Bigger upload limits and more AI points',
            ],
          },
          {
            name: 'Moderator',
            perks: ['The ModCP for the sections they look after'],
          },
          {
            name: 'Administrator',
            perks: ['The AdminCP, with staff permissions per plugin'],
          },
        ],
        title: 'Member, regular, moderator, admin',
        type: 'ladder',
      },
      {
        bullets: [
          'A dashboard with widgets you drag and resize',
          'Members, roles, moderators and administrators in one place',
          'Generated screens for blog posts, categories and the forum tree',
          'Send a message to members, straight to their notifications inbox',
        ],
        screen: 'dashboard',
        text: 'Everything the site runs on is managed from one panel, so the blog admin and the forum admin are the same person with the same login.',
        title: 'One AdminCP for the whole site',
        type: 'feature',
      },
      {
        description:
          'The shared foundation ships today. Some social features are on the roadmap, and anything specific to your community can be a plugin.',
        eyebrow: 'What a community site needs',
        items: [
          {
            label: 'Blog posts and forum topics on one site',
            status: 'available',
          },
          {
            label: 'One account with SSO and passkeys',
            status: 'available',
          },
          {
            label: 'Member profiles with an activity timeline',
            status: 'available',
          },
          { label: '⌘K search and the Discover feed', status: 'available' },
          {
            label: 'Notifications inbox with email digests',
            status: 'available',
          },
          { label: 'ModCP with reports and approvals', status: 'available' },
          { label: 'Events, polls and your own ideas', status: 'plugin' },
          { label: 'Reactions and followers', status: 'roadmap' },
          { label: 'Reply notifications', status: 'roadmap' },
        ],
        title: 'Ready today, and what is on the way',
        type: 'checklist',
      },
      {
        description: 'The member side and your side.',
        eyebrow: 'Two sides of the same site',
        screens: [
          {
            caption:
              'Members sign in with email, Google, Discord or Facebook, on your domain.',
            screen: 'login',
          },
          {
            caption:
              'Roles decide who posts, who moderates and who runs the place.',
            screen: 'roles',
          },
        ],
        title: 'Members and you',
        type: 'gallery',
      },
      {
        items: [
          {
            answer:
              'No. The blog, the forum and every plugin you add share one member account, one profile and one set of roles.',
            question:
              'Do members need separate accounts for the blog and the forum?',
          },
          {
            answer:
              'Yes. Write it as a plugin with the Content Engine and it gets a table, a typed API, AdminCP screens, search and translations from one definition.',
            question: 'Can we add a feature neither plugin has?',
          },
          {
            answer:
              'Daily work happens in the AdminCP and the ModCP, without code. Installing and adding plugins goes through a terminal, and the docs are written so an AI coding agent can do that part with you.',
            question: 'Can someone non-technical run it?',
          },
        ],
        title: 'Questions community owners ask',
        type: 'faq',
      },
    ],
    tagline: 'A blog, a forum and the people in both, on your domain.',
    title: 'Articles, forum and members under one sign-in.',
  },
  {
    ...solutionEntry('e-commerce'),
    audience: [
      'Independent shops',
      'Makers and brands',
      'Digital product sellers',
      'Agencies',
    ],
    description:
      'Customer accounts, a product catalog modelled with the Content Engine, translations, search, roles and a typed API ship today. Payments, carts and checkout are on the roadmap, so build the catalog and the community now and add checkout when it lands.',
    eyebrow: 'Solution · E-commerce',
    heroScreen: 'contentEditor',
    sections: [
      {
        description:
          'Each type is one definition in your plugin. The Content Engine creates the table, the typed API, the AdminCP screens, search and translations.',
        eyebrow: 'Your catalog as content types',
        title: 'Products, categories and reviews',
        type: 'model',
        types: [
          {
            fields: [
              'name (per language)',
              'slug (per language)',
              'description (rich text)',
              'price',
              'images',
              'category → container',
            ],
            name: 'Product',
          },
          {
            fields: ['name', 'description', 'parent category'],
            name: 'Category',
          },
          {
            fields: ['rating', 'body', 'author → member', 'product → relation'],
            name: 'Review',
          },
        ],
      },
      {
        description:
          'Selling is the piece on the roadmap. Everything around it ships in the canary today.',
        eyebrow: 'What a store needs',
        items: [
          { label: 'Product catalog as content types', status: 'available' },
          {
            label: 'Product names and URLs in every language',
            status: 'available',
          },
          { label: 'Search across the catalog', status: 'available' },
          {
            label: 'Customer accounts with SSO and passkeys',
            status: 'available',
          },
          {
            label: 'Product images on S3, R2 or Supabase',
            status: 'available',
          },
          { label: 'Scheduled product launches', status: 'available' },
          { label: 'Cart and checkout', status: 'roadmap' },
          { label: 'Payments and invoices', status: 'roadmap' },
          { label: 'Subscriptions', status: 'roadmap' },
          { label: 'Stock sync with your warehouse', status: 'plugin' },
        ],
        title: 'Ready today, and what is on the way',
        type: 'checklist',
      },
      {
        bullets: [
          'Drafts, revisions with a diff and restore',
          'Signed preview links for whoever approves the copy',
          'SEO fields, canonical URLs and a sitemap entry per product',
          'Images optimised to WebP on upload',
        ],
        illustrative: true,
        screen: 'contentEditor',
        text: 'The screenshot is the blog’s article editor. A Product type gets the same generated form with your own fields, so the team edits prices and photos in the AdminCP instead of asking a developer.',
        title: 'Product pages your team edits in the AdminCP',
        type: 'feature',
      },
      {
        description: 'What a new collection looks like before checkout lands.',
        eyebrow: 'Launch day',
        steps: [
          {
            Icon: Package,
            text: 'Add the products in the AdminCP: names, prices, photos and a category each.',
            title: 'Stock the shelf',
          },
          {
            Icon: Languages,
            text: 'Translate each field for every market. Each language gets its own URL and hreflang tags.',
            title: 'Translate',
          },
          {
            Icon: CalendarClock,
            text: 'Schedule the collection to go live at 9:00 on launch day, in every language at once.',
            title: 'Schedule',
          },
          {
            Icon: ShoppingCart,
            text: 'Checkout is the step on the roadmap. Until it lands, link each product to the checkout you already use.',
            title: 'Sell',
          },
        ],
        title: 'Stock, translate, schedule, sell',
        type: 'flow',
      },
      {
        bullets: [
          'Email sign-up with verification and password reset',
          'Google, Discord, Facebook and your own OAuth2 provider',
          'Passkeys, when you turn them on',
          'A devices page where customers sign out old sessions',
        ],
        screen: 'login',
        text: 'Customers get an account, a profile and a notifications inbox on day one. Captcha and rate limits keep the sign-up form boring for bots.',
        title: 'Customer accounts on day one',
        type: 'feature',
      },
      {
        items: [
          {
            answer:
              'Not inside VitNode yet. Payments, carts and checkout are on the roadmap. Until then, link products to the checkout or payment page you already use.',
            question: 'Can I take payments today?',
          },
          {
            answer:
              'Yes. Give a Review type member write access, add a rating field and turn reports on, so abusive reviews land on the ModCP board.',
            question: 'Can customers leave reviews?',
          },
          {
            answer:
              'Accounts, the catalog, translations and search are the slow parts of a store to build, and they ship today. Starting now means checkout is the last piece left when it lands.',
            question: 'Why start before payments ship?',
          },
        ],
        title: 'Questions shop owners ask',
        type: 'faq',
      },
    ],
    tagline:
      'Catalog, customers and content today. Payments are on the roadmap.',
    title: 'A store with its community already built.',
  },
  {
    ...solutionEntry('saas'),
    audience: [
      'Indie hackers',
      'Startup teams',
      'Agencies',
      'Internal tools teams',
    ],
    description:
      'Sign-in, sessions, roles, an admin panel, notifications, files, cron and a typed API come with the core. Write the feature your customers pay for as a plugin and treat plans as roles. Billing and subscriptions are on the roadmap.',
    eyebrow: 'Solution · SaaS app',
    heroScreen: 'login',
    sections: [
      {
        after: [
          'Sign-in, SSO, passkeys and sessions from the first install',
          'An AdminCP with users, roles, files and a debug panel',
          'Cron, a database queue with retries and a cache in the core',
          'AI points per role and a monthly budget for the whole app',
        ],
        before: [
          'Two weeks on sign-up, password reset and email verification',
          'An admin panel built from scratch for the support team',
          'A cron server, a queue and a Redis setup before the first feature',
          'An AI bill nobody can predict',
        ],
        eyebrow: 'The first month',
        title: 'Skip the month of plumbing',
        type: 'before-after',
      },
      {
        description:
          'Roles already carry upload limits, an AI policy and staff permissions. Your plugin reads the member’s role to decide what else a plan unlocks, and admins assign roles in the AdminCP.',
        eyebrow: 'Plans as roles',
        screen: 'roles',
        tiers: [
          {
            name: 'Free',
            perks: [
              'Signs in with email or SSO',
              'A small monthly AI allowance',
            ],
          },
          {
            name: 'Pro',
            perks: ['More AI points per month', 'A bigger upload limit'],
          },
          {
            name: 'Team',
            perks: ['The features your plugin unlocks for this role'],
          },
          {
            name: 'Staff',
            perks: [
              'Staff permissions per plugin',
              'The AdminCP and debug panel',
            ],
          },
        ],
        title: 'Free, pro, team, staff',
        type: 'ladder',
      },
      {
        description:
          'How a new feature goes from idea to running in production.',
        eyebrow: 'Shipping a feature',
        steps: [
          {
            Icon: Boxes,
            text: 'Describe the data with defineContentType. You get the table, the typed API and the AdminCP screens.',
            title: 'Model',
          },
          {
            Icon: Braces,
            text: 'Call your routes with the typed fetcher. Path, arguments and response are inferred, so a typo is a compile error.',
            title: 'Call',
          },
          {
            Icon: Inbox,
            text: 'Register a notification type in your plugin. Members get it in the inbox and by email, right away or in a digest.',
            title: 'Notify',
          },
          {
            Icon: Timer,
            text: 'Heavy work goes on the queue, scheduled work on cron. Both show up in the debug panel, and a cron job runs on demand with one click.',
            title: 'Run',
          },
        ],
        title: 'Model, call, notify, run',
        type: 'flow',
      },
      {
        bullets: [
          'One WebSocket with rooms, shared across instances through Redis',
          'Files on local disk, S3, R2 or Supabase, images converted to WebP',
          'Email through Nodemailer or Resend, templates in React Email',
          'OpenAPI docs for every route while you develop',
        ],
        screen: 'integrations',
        text: 'Each service your app depends on reports its status on one screen, with a test button next to it. You find out the email adapter is broken before a customer does.',
        title: 'The infrastructure, already wired',
        type: 'feature',
      },
      {
        description:
          'The account and admin side ships today. Billing is the big piece on the roadmap.',
        eyebrow: 'What a SaaS app needs',
        items: [
          {
            label: 'Accounts, SSO, custom OAuth2 and passkeys',
            status: 'available',
          },
          {
            label: 'Roles and staff permissions on the API',
            status: 'available',
          },
          {
            label: 'AI with per-role points and a monthly budget',
            status: 'available',
          },
          {
            label: 'Notifications inbox with email digests',
            status: 'available',
          },
          {
            label: 'Typed Hono API and real-time WebSocket',
            status: 'available',
          },
          { label: 'Cron jobs and a queue with retries', status: 'available' },
          { label: 'Workspaces and team accounts', status: 'plugin' },
          { label: 'Subscriptions and billing', status: 'roadmap' },
          { label: 'Two-factor sign-in', status: 'roadmap' },
          { label: 'Audit log and webhooks', status: 'roadmap' },
        ],
        title: 'Ready today, and what is on the way',
        type: 'checklist',
      },
      {
        items: [
          {
            answer:
              'Not yet. Billing and subscriptions are on the roadmap. Plans can already be roles, and an admin assigns them in the AdminCP.',
            question: 'Can I charge for plans today?',
          },
          {
            answer:
              'TanStack Start, Hono, Drizzle and PostgreSQL, all in TypeScript. Redis is optional; the cache falls back to memory without it.',
            question: 'What is the stack?',
          },
          {
            answer:
              'Yes. The docs come as llms.txt, llms-full.txt and a Markdown copy of every page, and a dozen guides have a Copy implementation prompt button.',
            question: 'Can my AI coding agent build on it?',
          },
        ],
        title: 'Questions founders ask',
        type: 'faq',
      },
    ],
    tagline:
      'Accounts, roles, admin and AI budgets ready. Billing is on the roadmap.',
    title: 'Write the feature. Accounts are already done.',
  },
]

export const SOLUTION_ICONS: Record<string, LucideIcon> = {
  blog: NotebookPen,
  community: Users,
  'e-commerce': ShoppingBag,
  forum: MessagesSquare,
  'gaming-guild': Gamepad2,
  'help-center': LifeBuoy,
  'membership-site': Crown,
  'multilingual-magazine': Newspaper,
  'open-source-hub': GitBranch,
  saas: AppWindow,
}

export const findSolution = (slug: string) =>
  SOLUTIONS.find((solution) => solution.slug === slug)
