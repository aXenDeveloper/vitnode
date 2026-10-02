const topics = [
  'Announcements',
  'Releases',
  'Plugins',
  'Themes',
  'Tutorials',
  'Showcase',
  'Help wanted',
  'Feedback',
  'Bug reports',
  'Off-topic',
]

const releases = [
  { name: 'Content Engine', version: 'v1.4.0' },
  { name: 'Search', version: 'v1.3.2' },
  { name: 'Passkeys', version: 'v1.3.0' },
  { name: 'Navigation', version: 'v1.2.5' },
  { name: 'Widgets', version: 'v1.2.0' },
  { name: 'Blog', version: 'v1.1.8' },
]

export default function ScrollFadeExample() {
  return (
    <div className="not-prose bg-card text-card-foreground flex w-full flex-col gap-6 rounded-xl border p-4 sm:p-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">Browse by topic</h3>
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            Scroll sideways. The left edge stays crisp until there is something
            hiding behind it.
          </p>
        </div>
        <div className="has-focus-visible:ring-ring/50 rounded-lg has-focus-visible:ring-3">
          <ul
            aria-label="Topics"
            className="scroll-fade-x no-scrollbar flex gap-2 overflow-x-auto overscroll-x-contain py-1 outline-none"
            role="region"
            tabIndex={0}
          >
            {topics.map((topic) => (
              <li
                className="bg-secondary text-secondary-foreground shrink-0 rounded-full px-3 py-1 text-sm"
                key={topic}
              >
                {topic}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Latest releases</h3>
        <div className="has-focus-visible:ring-ring/50 rounded-lg has-focus-visible:ring-3">
          <ul
            aria-label="Latest releases"
            className="scroll-fade-x scroll-fade-16 no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain outline-none"
            role="region"
            tabIndex={0}
          >
            {releases.map((release) => (
              <li
                className="bg-background flex w-36 shrink-0 snap-start flex-col gap-1 rounded-lg border p-3"
                key={release.name}
              >
                <span className="text-sm font-medium">{release.name}</span>
                <span className="text-muted-foreground font-mono text-xs">
                  {release.version}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
