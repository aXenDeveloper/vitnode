const Role = ({ children }: { children: string }) => (
  <span className="text-muted-foreground hidden w-32 shrink-0 font-mono text-xs sm:block">
    {children}
  </span>
)

const Row = ({
  children,
  role,
}: {
  children: React.ReactNode
  role: string
}) => (
  <div className="flex items-baseline gap-4">
    <Role>{role}</Role>
    <div className="min-w-0 flex-1">{children}</div>
  </div>
)

export default function TypographyHierarchy() {
  return (
    <div className="not-prose flex w-full flex-col gap-4">
      <Row role="text-2xl semibold">
        <h2 className="text-2xl font-semibold text-balance">Notifications</h2>
      </Row>
      <Row role="text-sm muted">
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          Choose what lands in your inbox and what waits for you here.
        </p>
      </Row>
      <Row role="text-lg medium">
        <h3 className="text-lg font-medium">Replies</h3>
      </Row>
      <Row role="text-sm">
        <p className="text-sm leading-relaxed text-pretty">
          Get an email when someone replies to a topic you started or follow.
          Replies to your own replies are bundled into one daily summary.
        </p>
      </Row>
      <Row role="text-xs muted">
        <span className="text-muted-foreground text-xs tabular-nums">
          Last changed 3 days ago
        </span>
      </Row>
    </div>
  )
}
