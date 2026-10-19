export interface Integration {
  description: string
  docs: string
  name: string
  packageName?: string
}

export interface IntegrationGroup {
  description: string
  items: Integration[]
  title: string
}

export const INTEGRATION_GROUPS: IntegrationGroup[] = [
  {
    description:
      'Members find posts, articles and topics from one search bar, with suggestions on every key.',
    items: [
      {
        description:
          'Full-text search per language with ranking, highlights and filters. On by default.',
        docs: 'dev/search',
        name: 'PostgreSQL search',
      },
      {
        description:
          'Move search to an Elasticsearch cluster when the database search is not enough.',
        docs: 'dev/search-elasticsearch',
        name: 'Elasticsearch',
        packageName: '@vitnode/elasticsearch',
      },
    ],
    title: 'Search',
  },
  {
    description:
      'Avatars, covers and attachments go to the storage you pick, with WebP optimisation on upload.',
    items: [
      {
        description:
          'Files on the server’s own disk. The default for local development.',
        docs: 'dev/storage/local',
        name: 'Local storage',
      },
      {
        description: 'Amazon S3, Cloudflare R2 or any S3-compatible bucket.',
        docs: 'dev/storage/s3-r2',
        name: 'S3 and Cloudflare R2',
        packageName: '@vitnode/s3',
      },
      {
        description: 'Supabase Storage buckets for teams already on Supabase.',
        docs: 'dev/storage/supabase',
        name: 'Supabase Storage',
        packageName: '@vitnode/supabase-storage',
      },
    ],
    title: 'File storage',
  },
  {
    description:
      'Verification, password resets and notification digests, built with React Email templates.',
    items: [
      {
        description: 'Send through any SMTP server you already have.',
        docs: 'dev/email/nodemailer',
        name: 'Nodemailer',
        packageName: '@vitnode/nodemailer',
      },
      {
        description: 'Send through the Resend API with an API key.',
        docs: 'dev/email/resend',
        name: 'Resend',
        packageName: '@vitnode/resend',
      },
    ],
    title: 'Email',
  },
  {
    description:
      'Members sign in with accounts they already have, or with a passkey instead of a password.',
    items: [
      {
        description:
          'Google, Discord and Facebook adapters, plus a custom OAuth2 adapter for your own accounts.',
        docs: 'dev/sso',
        name: 'Social sign-in and OAuth2',
      },
      {
        description:
          'Passwordless sign-in for members and for the AdminCP. Opt-in.',
        docs: 'dev/passkeys',
        name: 'Passkeys',
      },
      {
        description:
          'Cloudflare Turnstile or Google reCAPTCHA v3 on sign-up and sign-in.',
        docs: 'dev/captcha',
        name: 'Captcha',
      },
    ],
    title: 'Sign-in and protection',
  },
  {
    description:
      'AI actions, automatic ALT text and translations run on the model you choose, within a budget you set.',
    items: [
      {
        description:
          'Any provider the Vercel AI SDK supports, picked per action, with a fallback model.',
        docs: 'dev/ai',
        name: 'AI models',
      },
    ],
    title: 'AI',
  },
  {
    description:
      'Scheduled jobs and a database queue keep digests, ALT text and cleanups running in the background.',
    items: [
      {
        description: 'Run cron jobs inside a long-running Node.js server.',
        docs: 'dev/cron',
        name: 'node-cron',
        packageName: '@vitnode/node-cron',
      },
      {
        description:
          'Cache, rate limits and WebSocket messages shared across every server instance.',
        docs: 'dev/websocket',
        name: 'Redis',
      },
    ],
    title: 'Background jobs and scaling',
  },
  {
    description: 'Deploy to a platform or run it on a server you control.',
    items: [
      {
        description: 'Deploy the app to Vercel with the Nitro preset.',
        docs: 'dev/deployments/cloud/vercel',
        name: 'Vercel',
      },
      {
        description:
          'Run the Node.js server with PostgreSQL on your own machine or VPS.',
        docs: 'dev/deployments/self-hosted',
        name: 'Self-hosted',
      },
    ],
    title: 'Hosting',
  },
]

export type ExtensionKind = 'adapter' | 'plugin' | 'tool'

export interface Extension {
  description: string
  docs?: string
  kind: ExtensionKind
  name: string
}

export const EXTENSION_KINDS: {
  description: string
  kind: ExtensionKind
  title: string
}[] = [
  {
    description:
      'Add pages, content types, admin screens and permissions to your site.',
    kind: 'plugin',
    title: 'Plugins',
  },
  {
    description:
      'Connect search, storage, email and jobs to the service you already use.',
    kind: 'adapter',
    title: 'Adapters',
  },
  {
    description: 'Start a project and keep its tooling consistent.',
    kind: 'tool',
    title: 'Tools',
  },
]

export const EXTENSIONS: Extension[] = [
  {
    description:
      'Articles with an SEO checklist, translations, AI actions, scheduling, revisions and live co-editing.',
    docs: 'guides/blog',
    kind: 'plugin',
    name: '@vitnode/blog',
  },
  {
    description:
      'Forum sections, topics and nested comments, with approval rules and moderators per section.',
    docs: 'guides/forum',
    kind: 'plugin',
    name: '@vitnode/forum',
  },
  {
    description:
      'A reference plugin that exercises the Content Engine end to end. Read it before writing your own.',
    docs: 'guides/first-plugin',
    kind: 'plugin',
    name: '@vitnode/example',
  },
  {
    description: 'Elasticsearch search engine for content discovery.',
    docs: 'dev/search-elasticsearch',
    kind: 'adapter',
    name: '@vitnode/elasticsearch',
  },
  {
    description: 'Amazon S3 and Cloudflare R2 storage for file uploads.',
    docs: 'dev/storage/s3-r2',
    kind: 'adapter',
    name: '@vitnode/s3',
  },
  {
    description: 'Supabase Storage for file uploads.',
    docs: 'dev/storage/supabase',
    kind: 'adapter',
    name: '@vitnode/supabase-storage',
  },
  {
    description: 'Email through any SMTP server.',
    docs: 'dev/email/nodemailer',
    kind: 'adapter',
    name: '@vitnode/nodemailer',
  },
  {
    description: 'Email through the Resend API.',
    docs: 'dev/email/resend',
    kind: 'adapter',
    name: '@vitnode/resend',
  },
  {
    description: 'Cron job scheduling inside a Node.js server.',
    docs: 'dev/cron',
    kind: 'adapter',
    name: '@vitnode/node-cron',
  },
  {
    description:
      'Members, roles, sign-in, the AdminCP, the ModCP, search, notifications, AI and the Content Engine.',
    docs: 'dev',
    kind: 'tool',
    name: '@vitnode/core',
  },
  {
    description:
      'Scaffold a new VitNode app, a monorepo or a plugin in a few minutes.',
    docs: 'dev/setup',
    kind: 'tool',
    name: 'create-vitnode-app',
  },
  {
    description:
      'Shared Oxlint, Oxfmt and TypeScript configuration for VitNode projects.',
    kind: 'tool',
    name: '@vitnode/config',
  },
]

export const installCommand = (extension: Extension) =>
  extension.kind === 'tool' && extension.name === 'create-vitnode-app'
    ? 'pnpm create vitnode-app@canary'
    : `pnpm add ${extension.name}@canary`
