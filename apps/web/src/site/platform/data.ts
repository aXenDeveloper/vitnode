import { Bot, CodeXml, ShieldCheck, Users } from 'lucide-react'

import type { ScreenKey } from '@/site/marketing/screens'
import type { SolutionSection } from '@/site/solutions/data'

import type { PlatformSlug } from './catalog'

export interface PlatformPage {
  description: string
  eyebrow: string
  heroScreen: ScreenKey
  sections: SolutionSection[]
  title: string
}

export const WHY_VITNODE: PlatformPage = {
  description:
    'VitNode puts a forum, a blog, member accounts, moderation and an admin panel on one TypeScript core that you host yourself. Here is why that beats stitching five tools together, and where it still falls short.',
  eyebrow: 'Why VitNode',
  heroScreen: 'dashboard',
  sections: [
    {
      after: [
        'Articles and forum topics in one app, on one member account',
        'Roles, search, notifications and moderation that work the same everywhere',
        'Translations per field, with localized URLs and hreflang',
        'An MIT licence, no paid tier and a PostgreSQL database you own',
      ],
      before: [
        'A CMS for articles and separate forum software for threads',
        'Two logins, two user tables and two sets of permissions',
        'Moderation spread across plugins, bots and spreadsheets',
        'Licence fees that grow with the community',
      ],
      eyebrow: 'The difference',
      title: 'From five stitched tools to one site',
      type: 'before-after',
    },
    {
      description:
        'Most communities have all four of these people, and sometimes they are the same person on different days.',
      eyebrow: 'Who it is for',
      steps: [
        {
          Icon: ShieldCheck,
          text: 'Run members, roles, content and reports from the AdminCP and the ModCP, without touching code.',
          title: 'Admins',
        },
        {
          Icon: CodeXml,
          text: 'Skip sign-in, roles and admin screens. One content type definition gives a table, a typed API and AdminCP screens.',
          title: 'Developers',
        },
        {
          Icon: Bot,
          text: 'Hand the setup to a coding agent. Every docs page has a Markdown version and the whole set is one file at /llms-full.txt.',
          title: 'Builders with AI agents',
        },
        {
          Icon: Users,
          text: 'Sign in with Google, Discord, Facebook or a passkey, then find anything with search that suggests as they type.',
          title: 'Members',
        },
      ],
      title: 'Built for the people who run a community',
      type: 'flow',
    },
    {
      bullets: [
        'A dashboard with widgets you drag, resize and add from plugins',
        'Members, roles, moderators and administrators in one panel',
        'AI budgets per role, so the monthly bill stays predictable',
        'System status, update checks and security update checks',
      ],
      screen: 'dashboard',
      text: 'The parts every community needs ship in the core, so a plugin only adds the feature your people asked for.',
      title: 'Built in, so nothing is bolted on',
      type: 'feature',
    },
    {
      description:
        'VitNode 2.0 is a canary build. This is what ships today and what is still on the way, so nobody finds out the hard way.',
      eyebrow: 'Straight answers',
      items: [
        { label: 'Forum and blog plugins', status: 'available' },
        {
          label: 'Per-field translations and localized URLs',
          status: 'available',
        },
        {
          label: 'ModCP reports board and approval queue',
          status: 'available',
        },
        { label: 'AI actions with budgets per role', status: 'available' },
        { label: 'Passkeys and social sign-in', status: 'available' },
        {
          label: 'Live co-editing and realtime notifications',
          status: 'available',
        },
        { label: 'Two-factor authentication', status: 'roadmap' },
        { label: 'Warnings and bans', status: 'roadmap' },
        { label: 'Payments and subscriptions', status: 'roadmap' },
        { label: 'Importers from other platforms', status: 'roadmap' },
      ],
      title: 'What ships today, and what is next',
      type: 'checklist',
    },
    {
      items: [
        {
          answer:
            'Yes. VitNode is MIT-licensed, with no paid tier and no member limits. You pay only for hosting, on your own server or a platform such as Vercel.',
          question: 'Is VitNode free?',
        },
        {
          answer:
            'Not yet. VitNode 2.0 is a canary build, so expect bugs and breaking changes between releases. It suits new projects and prototypes today.',
          question: 'Can I run a production community on it today?',
        },
        {
          answer:
            'Discourse, XenForo and Invision Community are mature forum products with more discussion features today. VitNode treats articles and forum topics as content on one TypeScript core, with translations and AI budgets built in. The comparison pages go row by row.',
          question: 'How does it compare with Discourse, XenForo or Invision?',
        },
      ],
      title: 'Questions people ask before switching',
      type: 'faq',
    },
  ],
  title: 'One open-source home for your content, your members and your rules.',
}

export const PLATFORM_PAGES: Record<PlatformSlug, PlatformPage> = {
  admincp: {
    description:
      'The AdminCP at /admin runs members, roles, content, AI and system health from one place. It has its own session that signs itself out after an hour of inactivity.',
    eyebrow: 'Platform · AdminCP',
    heroScreen: 'dashboard',
    sections: [
      {
        bullets: [
          'Widgets you drag and resize: system updates, notes, send a notification',
          'Plugins add their own widgets to the same grid',
          'A separate admin sign-in, with passkeys if you turn them on',
          'An idle timeout that signs staff out after an hour',
        ],
        screen: 'dashboard',
        text: 'The first screen your staff sees. Rearrange it once and it stays that way for you.',
        title: 'A dashboard you arrange yourself',
        type: 'feature',
      },
      {
        bullets: [
          'Primary and secondary roles with colours, prefixes and upload limits',
          'Staff permissions per plugin and per action, enforced on the API',
          'Moderators limited to the forum sections they look after',
          'Avatar, cover, name and email edits for any member',
        ],
        screen: 'roles',
        text: 'Decide who writes, who reviews and who moderates. The API enforces it and the UI follows.',
        title: 'Members, roles and staff',
        type: 'feature',
      },
      {
        bullets: [
          'List and form screens generated from each content type',
          'Bulk actions, history, schedule and delivery views',
          'Drafts, revisions with a diff, and restore',
          'Live co-editing with presence and field locks',
        ],
        screen: 'contentEditor',
        text: 'Every content type a plugin defines gets its own AdminCP screens, with no admin code written by hand.',
        title: 'Content screens for every plugin',
        type: 'feature',
      },
      {
        bullets: [
          'Status cards for AI, WebSocket, Redis, email, storage, cron and the queue',
          'Update and security update checks for core and plugins',
          'A debug panel with logs, cron runs, the queue, cache and search index',
          'Files with ALT text and a guard against deleting files in use',
        ],
        screen: 'integrations',
        text: 'When something breaks, the AdminCP tells you which service it is before a member does.',
        title: 'System health in one place',
        type: 'feature',
      },
      {
        description:
          'The AdminCP covers daily work. A few jobs still happen in code on purpose, and a few are on the way.',
        eyebrow: 'What lives where',
        items: [
          { label: 'AI overview, actions and history', status: 'available' },
          {
            label: 'Notification policies and delivery stats',
            status: 'available',
          },
          { label: 'Search index screen with reindex', status: 'available' },
          { label: 'Moderation in the ModCP at /modcp', status: 'available' },
          { label: 'Installing plugins from the AdminCP', status: 'roadmap' },
          { label: 'Staff audit log', status: 'roadmap' },
        ],
        title: 'Ready today, and what is on the way',
        type: 'checklist',
      },
      {
        items: [
          {
            answer:
              'Navigation items and languages live in vitnode.config.ts. Changes are versioned with your code and reviewed like any other pull request.',
            question: 'Can I edit the navigation or languages in the AdminCP?',
          },
          {
            answer:
              'Yes. The ModCP at /modcp is a front-end panel for moderators, with a reports board and an approval queue. Admins work in the AdminCP at /admin.',
            question: 'Do moderators need AdminCP access?',
          },
          {
            answer:
              'The AdminCP session ends after an hour without activity, and its cookie ends with the browser.',
            question: 'How long does an admin session last?',
          },
        ],
        title: 'Questions admins ask',
        type: 'faq',
      },
    ],
    title: 'An admin panel your team will actually open.',
  },
  core: {
    description:
      '@vitnode/core gives every VitNode site members, roles, sign-in, an AdminCP, a ModCP, search, notifications, AI and the Content Engine. Plugins add the forum, the blog or a feature of your own on top.',
    eyebrow: 'Platform · Core',
    heroScreen: 'login',
    sections: [
      {
        bullets: [
          'Email sign-up with verification and password reset',
          'Google, Discord, Facebook and custom OAuth2 sign-in',
          'Passkeys, and a devices page to sign out other sessions',
          'Profiles with avatar, cover and an activity timeline',
        ],
        screen: 'login',
        text: 'Accounts work the same for every plugin, so a reader who comments on an article can join the forum without signing up twice.',
        title: 'Members and sign-in',
        type: 'feature',
      },
      {
        description:
          'Each card is one file in a plugin. The Content Engine turns it into storage, an API and admin screens.',
        eyebrow: 'The Content Engine',
        title: 'One definition, a whole feature',
        type: 'model',
        types: [
          { fields: ['title', 'slug', 'body', 'cover'], name: 'Article' },
          { fields: ['name', 'parent', 'policy'], name: 'Forum section' },
          { fields: ['title', 'content', 'section'], name: 'Topic' },
          { fields: ['question', 'answer', 'tags'], name: 'Guide' },
        ],
      },
      {
        bullets: [
          'Translations per field, with fallback and localized URLs',
          'Drafts, scheduled publishing, revisions with a diff',
          'Signed preview links, approvals and nested comment threads',
          'SEO fields, canonical URLs, sitemap and hreflang',
        ],
        screen: 'contentEditor',
        text: 'Every content type gets the same publishing tools, whether it comes from the blog plugin or from yours.',
        title: 'Publishing built in',
        type: 'feature',
      },
      {
        description:
          'The services a community site leans on every day, all included in the core.',
        eyebrow: 'Included',
        items: [
          {
            label: 'Search with live suggestions, PostgreSQL or Elasticsearch',
            status: 'available',
          },
          {
            label: 'Notifications inbox, live count and email digests',
            status: 'available',
          },
          { label: 'Realtime updates over one WebSocket', status: 'available' },
          {
            label: 'AI actions with budgets, any provider',
            status: 'available',
          },
          {
            label: 'File storage: local, S3 or R2, Supabase',
            status: 'available',
          },
          { label: 'Email through Nodemailer or Resend', status: 'available' },
          { label: 'Cron jobs and a queue with retries', status: 'available' },
          { label: 'Two-factor authentication', status: 'roadmap' },
          { label: 'Webhooks', status: 'roadmap' },
        ],
        title: 'What else ships in the core',
        type: 'checklist',
      },
      {
        items: [
          {
            answer:
              'A plugin adds pages, API routes, content types, admin screens, permissions and events. The blog and the forum are plugins, and so is anything you build.',
            question: 'What is the difference between the core and a plugin?',
          },
          {
            answer:
              'TanStack Start renders the pages, Hono serves the API and Drizzle talks to PostgreSQL. All of it is TypeScript.',
            question: 'What is it built with?',
          },
        ],
        title: 'Questions about the core',
        type: 'faq',
      },
    ],
    title: 'Everything a community site needs, in one package.',
  },
  security: {
    description:
      'Hashed passwords and sessions, passkeys, captcha, rate limits, CSRF and origin checks, row-level security and a separate admin session ship in the core. You do not rebuild them for every project.',
    eyebrow: 'Platform · Security',
    heroScreen: 'login',
    sections: [
      {
        bullets: [
          'Passwords hashed with scrypt, sessions stored hashed in HttpOnly cookies',
          'Email verification and password reset',
          'Passkeys for members and for the AdminCP',
          'A devices page where members sign out sessions they do not recognise',
        ],
        screen: 'login',
        text: 'Sign-in is the part attackers try first, so it ships done and tested in the core.',
        title: 'Accounts and sessions',
        type: 'feature',
      },
      {
        bullets: [
          'Staff permissions per plugin and per action, checked on the API',
          'Moderators scoped to the sections they look after',
          'A separate AdminCP session with a one-hour idle timeout',
          'Admins can revoke one session or all of them for any member',
        ],
        screen: 'roles',
        text: 'Every admin and moderator action passes a permission check on the server, whatever the UI shows.',
        title: 'Permissions that hold on the server',
        type: 'feature',
      },
      {
        description:
          'Layers that ship in the core today, and the ones still on the way.',
        eyebrow: 'Protection layers',
        items: [
          {
            label: 'Captcha with Cloudflare Turnstile or reCAPTCHA v3',
            status: 'available',
          },
          {
            label: 'Rate limits per category, shared through Redis',
            status: 'available',
          },
          { label: 'CSRF and origin checks', status: 'available' },
          { label: 'Row-level security on core tables', status: 'available' },
          {
            label: 'No source code or stack traces on production error pages',
            status: 'available',
          },
          {
            label: 'Security update checks in the AdminCP',
            status: 'available',
          },
          { label: 'Two-factor authentication', status: 'roadmap' },
          { label: 'Staff audit log', status: 'roadmap' },
          {
            label: 'Personal data export and account deletion',
            status: 'roadmap',
          },
        ],
        title: 'Defence in depth',
        type: 'checklist',
      },
      {
        bullets: [
          'Checks for new releases of the core and every plugin',
          'A separate channel for security fixes',
          'Integration status cards that flag a broken service',
        ],
        screen: 'integrations',
        text: 'The AdminCP tells you when a security fix is out, so a patch does not wait for someone to read a changelog.',
        title: 'Updates you will notice',
        type: 'feature',
      },
      {
        items: [
          {
            answer:
              'Not yet. Passkeys work today for members and for the AdminCP. Authenticator-app codes are on the roadmap.',
            question: 'Does VitNode have two-factor authentication?',
          },
          {
            answer:
              'In your PostgreSQL database, on a server you choose. VitNode has no hosted plan, so nothing leaves your infrastructure unless you send it.',
            question: 'Where are member accounts stored?',
          },
          {
            answer:
              'Not yet. VitNode 2.0 is a canary build. Expect breaking changes between releases and review it before you trust it with real accounts.',
            question: 'Is it ready for a production community?',
          },
        ],
        title: 'Questions security reviewers ask',
        type: 'faq',
      },
    ],
    title: 'Security work you do not redo for every project.',
  },
}
