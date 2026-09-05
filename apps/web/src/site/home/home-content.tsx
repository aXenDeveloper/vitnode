import {
  ArrowDown,
  ArrowRight,
  Check,
  Cloud,
  Code2,
  Heart,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'

import type { SiteLinkComponent } from '#/site/home/site-link'

import adminControlPanel from '#/site/home/assets/admin-control-panel.png'
import {
  FeatureGrid,
  PluginDiagram,
  CommunityPreview,
  AgentPreview,
  SecurityDiagram,
} from '#/site/home/visuals'
import { ComparisonSection } from '#/site/home/comparison'
import {
  CanaryNotice,
  MarketingActions,
  SectionHeading,
} from '#/site/marketing/shared'

const adminFeatures = [
  {
    Icon: Users,
    title: 'People, properly organized',
    text: 'Manage accounts, roles, and staff access from one familiar place.',
  },
  {
    Icon: Code2,
    title: 'Your plugins feel at home',
    text: 'Add screens and navigation alongside the built-in management tools.',
  },
  {
    Icon: ShieldCheck,
    title: 'The right keys, for the right people',
    text: 'Grant access by role or staff member, down to specific plugin actions.',
  },
]

export const HomeRouteContent = ({
  LinkComponent: Link,
}: {
  LinkComponent: SiteLinkComponent
}) => (
  <div className="marketing" lang="en">
    <section
      className="marketing-shell marketing-hero"
      aria-labelledby="home-title"
    >
      <div className="hero-copy">
        <Link className="canary-pill" href="/docs/dev/setup">
          <span className="status-dot" /> VitNode 2.0 · Canary{' '}
          <ArrowRight size={14} aria-hidden />
        </Link>
        <p className="eyebrow">The open-source community framework</p>
        <h1 id="home-title">
          Your people.
          <br />
          Your platform.
          <br />
          <span>Your rules.</span>
        </h1>
        <p className="hero-description">
          Turn an audience into a place people belong. Build a customer hub, a
          knowledge space, or your next big community idea—with the boring bits
          already invited.
        </p>
        <MarketingActions LinkComponent={Link} />
        <p className="quiet-note">
          Free & open source. Yours to shape. Even the weird ideas.
        </p>
      </div>
      <div className="hero-visual">
        <CommunityPreview />
        <p className="visual-caption">
          A little preview of what you can build with plugins.
        </p>
      </div>
    </section>
    <div className="marketing-shell">
      <CanaryNotice LinkComponent={Link} />
    </div>
    <section
      className="marketing-shell outcomes"
      aria-label="Why build with VitNode"
    >
      {[
        [
          'Make knowledge stick',
          'Give helpful content a home your customers can find again.',
        ],
        [
          'Give your team a head start',
          'Spend less time rebuilding accounts, admin screens, and permissions.',
        ],
        [
          'Keep your options open',
          'Own the code and choose the services that fit your business.',
        ],
      ].map(([title, description], index) => (
        <div key={title}>
          <span className="eyebrow">0{index + 1}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      ))}
    </section>
    <section
      className="marketing-shell marketing-section"
      id="features"
      aria-labelledby="features-title"
    >
      <SectionHeading
        eyebrow="Small pieces. Big possibilities."
        title="The good stuff comes together."
        id="features-title"
      >
        Less time connecting the basics. More time making something your people
        love.
      </SectionHeading>
      <FeatureGrid LinkComponent={Link} />
    </section>
    <section
      className="marketing-band"
      id="plugins"
      aria-labelledby="plugins-title"
    >
      <div className="marketing-shell marketing-section split-section">
        <div className="section-copy">
          <SectionHeading
            eyebrow="The plugin system"
            title="Big ideas. Small, swappable pieces."
            id="plugins-title"
          >
            Your community shouldn’t outgrow its own software. Keep each feature
            together as a plugin, and build on it without turning the whole app
            upside down.
          </SectionHeading>
          <ul className="check-list">
            <li>
              <Check aria-hidden /> Keep a feature’s pages, data, and admin
              tools together.
            </li>
            <li>
              <Check aria-hidden /> Add what your business needs as it grows.
            </li>
            <li>
              <Check aria-hidden /> Reuse your work across projects.
            </li>
          </ul>
          <Link className="text-link" href="/docs/dev/plugins/create">
            Meet your next plugin <ArrowRight aria-hidden size={16} />
          </Link>
        </div>
        <div className="diagram-panel">
          <PluginDiagram />
          <div className="diagram-caption">
            <span className="status-dot" /> One home for every part of a
            feature.
          </div>
        </div>
      </div>
    </section>
    <section
      className="marketing-shell marketing-section"
      id="admincp"
      aria-labelledby="admin-title"
    >
      <div className="section-heading-row">
        <SectionHeading
          eyebrow="Admin Control Panel"
          title="Meet your community’s control room."
          id="admin-title"
        >
          Content, people, permissions, and integrations in one place. Your team
          gets a workspace. You get fewer “where do I change this?” messages.
        </SectionHeading>
        <Link className="text-link" href="/docs/dev/plugins/admin">
          Explore AdminCP <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
      <figure className="admin-preview">
        <div className="window-bar">
          <span className="window-dots" aria-hidden>
            ● ● ●
          </span>
          <span>VitNode / Admin Control Panel</span>
          <span className="small-label">Actual product</span>
        </div>
        <img
          alt="VitNode AdminCP with its management navigation and debugging tools."
          decoding="async"
          height={1392}
          loading="lazy"
          src={adminControlPanel}
          width={2880}
        />
        <figcaption>
          Built-in management, with room for your plugins’ own screens and
          dashboard widgets.
        </figcaption>
      </figure>
      <div className="three-up">
        {adminFeatures.map(({ Icon, title, text }) => (
          <article key={title}>
            <Icon aria-hidden />
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
    <section
      className="marketing-shell marketing-section split-section community-section"
      id="community"
      aria-labelledby="community-title"
    >
      <div className="section-copy">
        <SectionHeading
          eyebrow="Made for people, managed by people"
          title="A community. With a little less chaos."
          id="community-title"
        >
          Give members a place to belong and staff the access they need. Growing
          your community shouldn’t mean giving everyone the master key.
        </SectionHeading>
        <Link
          className="text-link"
          href="/docs/dev/working-with-users/staff-permissions"
        >
          See how staff access works <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
      <div className="community-cards">
        <article>
          <Users aria-hidden />
          <div>
            <h3>Member roles</h3>
            <p>
              Organize people into groups and shape access around your
              community.
            </p>
          </div>
          <span className="small-label">Included</span>
        </article>
        <article>
          <ShieldCheck aria-hidden />
          <div>
            <h3>Staff permissions</h3>
            <p>
              Separate administrator and moderator privileges, with per-plugin
              controls.
            </p>
          </div>
          <span className="small-label">Included</span>
        </article>
        <article>
          <LockKeyhole aria-hidden />
          <div>
            <h3>Moderator CP</h3>
            <p>
              Moderator roles and permissions are here. A dedicated moderation
              workspace is still ahead.
            </p>
          </div>
          <span className="small-label muted-label">Not shipped</span>
        </article>
      </div>
    </section>
    <section className="marketing-band" id="ai" aria-labelledby="ai-title">
      <div className="marketing-shell marketing-section split-section">
        <AgentPreview />
        <div className="section-copy">
          <SectionHeading
            eyebrow="Built for humans. And their AI agents."
            title="Give your coding agent a map."
            id="ai-title"
          >
            Readable docs, clear plugin boundaries, and shared conventions help
            your agent work with your project. Less guessing where things go.
            More progress you can review.
          </SectionHeading>
          <div className="tag-row">
            <span>Agent instructions</span>
            <span>Full-text docs</span>
            <span>Typed building blocks</span>
          </div>
          <p className="muted-copy">
            Building AI into your product? Connect a provider to add summaries,
            streaming responses, and other useful features through the AI SDK.
            Your team builds the experience; you choose the model.
          </p>
          <div className="inline-links">
            <Link className="text-link" href="/llms-full.txt">
              Docs for your agent <ArrowDown size={16} aria-hidden />
            </Link>
            <Link className="text-link" href="/docs/dev/ai">
              Build with AI <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </section>
    <section
      className="marketing-shell marketing-section split-section"
      id="security"
      aria-labelledby="security-title"
    >
      <div className="section-copy">
        <SectionHeading
          eyebrow="A warmer welcome. A smarter front door."
          title="Let people in. Keep access in check."
          id="security-title"
        >
          Make joining easier with social sign-in, and protect your community
          with configurable safeguards.
        </SectionHeading>
        <div className="security-list">
          <div>
            <h3>SSO & social login</h3>
            <p>
              Connect Google, Discord, or Facebook—or write a custom provider
              adapter.
            </p>
          </div>
          <div>
            <h3>CAPTCHA & rate limits</h3>
            <p>
              Use Cloudflare Turnstile or reCAPTCHA and configure request limits
              to help reduce abuse.
            </p>
          </div>
          <div>
            <h3>Permission-aware access</h3>
            <p>
              Sessions and staff permissions help protect private actions. Your
              deployment and plugin checks matter too.
            </p>
          </div>
        </div>
        <Link className="text-link" href="/docs/dev/advanced/auth">
          Explore authentication <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
      <div className="diagram-panel security-panel">
        <SecurityDiagram />
        <div className="security-links">
          <Link href="/docs/dev/sso">SSO providers ↗</Link>
          <Link href="/docs/dev/captcha">CAPTCHA setup ↗</Link>
        </div>
      </div>
    </section>
    <section
      className="marketing-shell marketing-section"
      id="hosting"
      aria-labelledby="hosting-title"
    >
      <SectionHeading
        eyebrow="Your code. Your choice of address."
        title="In the cloud. Or on your own turf."
        id="hosting-title"
      >
        Choose where your community lives, and keep control of the code behind
        it.
      </SectionHeading>
      <div className="hosting-grid">
        <article className="hosting-card">
          <Cloud aria-hidden />
          <span className="eyebrow">Bring your cloud</span>
          <h3>A little less server wrangling.</h3>
          <p>
            Deploy with the Vercel guide and choose your database, storage, and
            other services.
          </p>
          <Link className="text-link" href="/docs/dev/deployments/cloud/vercel">
            Cloud deployment <ArrowRight size={16} aria-hidden />
          </Link>
          <p className="quiet-note">
            Vercel does not run the built-in WebSocket server, local uploads, or
            in-process cron.
          </p>
        </article>
        <article className="hosting-card">
          <Code2 aria-hidden />
          <span className="eyebrow">Self-host</span>
          <h3>Home is where your server is.</h3>
          <p>
            Run on your own infrastructure with long-lived connections, local
            storage, and full control.
          </p>
          <Link className="text-link" href="/docs/dev/deployments/self-hosted">
            Self-hosting guide <ArrowRight size={16} aria-hidden />
          </Link>
          <p className="quiet-note">
            You manage updates, backups, security, and running costs. The
            software is free.
          </p>
        </article>
      </div>
    </section>
    <ComparisonSection />
    <section
      className="marketing-shell marketing-section split-section developer-section"
      aria-labelledby="developer-title"
    >
      <div className="section-copy">
        <SectionHeading
          eyebrow="A little something for the builders"
          title="Less setup déjà vu."
          id="developer-title"
        >
          Start a project, build a plugin, and make it yours. Familiar tools
          underneath. More of your actual product on top.
        </SectionHeading>
        <div className="tag-row">
          <span>React</span>
          <span>TanStack Start</span>
          <span>Hono</span>
          <span>PostgreSQL</span>
          <span>TypeScript</span>
        </div>
        <Link className="text-link" href="/docs/guides/first-plugin">
          Build your first plugin <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
      <div className="code-panel">
        <div className="window-bar">
          <span>terminal</span>
          <span>01 / Create your app</span>
        </div>
        <pre>
          <code>
            <span className="code-comment"># Choose Turborepo for plugins</span>
            {'\n'}pnpm create vitnode-app@canary{'\n\n'}
            <span className="code-comment"># Inside your new project</span>
            {'\n'}pnpm docker:dev{'\n'}pnpm db:migrate{'\n'}pnpm dev
          </code>
        </pre>
        <Link href="/docs/dev/setup">
          Node.js 22+ · Postgres or Docker · Full setup guide ↗
        </Link>
      </div>
    </section>
    <section
      className="marketing-shell marketing-section"
      id="maker"
      aria-labelledby="maker-title"
    >
      <div className="maker-card">
        <div className="maker-portrait">
          <img
            src="https://avatars.githubusercontent.com/u/58148176?v=4"
            width={240}
            height={240}
            loading="lazy"
            decoding="async"
            alt="Maciej Balcerzak, creator of VitNode"
          />
          <span className="small-label">
            <Heart size={14} aria-hidden /> Made by a human
          </span>
        </div>
        <div className="section-copy">
          <p className="eyebrow">A note from the maker</p>
          <h2 id="maker-title">
            Hi, I’m Maciej.
            <br />
            <span className="muted-copy">I’m building VitNode.</span>
          </h2>
          <p>
            I want building a community to feel like creating something for
            people—not signing up to rebuild the same admin panel forever.
          </p>
          <p>
            VitNode is my open-source take on that idea: a shared foundation,
            room for your own plugins, and the freedom to make it yours. It’s
            early. Come help shape what happens next.
          </p>
          <a className="text-link" href="https://github.com/aXenDeveloper">
            Maciej Balcerzak · @aXenDeveloper{' '}
            <ArrowRight size={16} aria-hidden />
          </a>
        </div>
      </div>
    </section>
    <section className="marketing-shell marketing-section">
      <div className="final-cta">
        <Sparkles aria-hidden />
        <p className="eyebrow">A good place to start something</p>
        <h2>
          Your next community
          <br />
          starts with a little curiosity.
        </h2>
        <p>Bring an idea. Bring your people later.</p>
        <MarketingActions LinkComponent={Link} />
        <Link className="text-link" href="/pricing">
          Check the price. Spoiler: it’s $0.{' '}
          <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    </section>
  </div>
)
