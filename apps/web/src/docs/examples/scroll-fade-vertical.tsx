const notifications = [
  { title: 'New sign-up from Warsaw', time: '2 min ago' },
  { title: 'Blog post published', time: '14 min ago' },
  { title: 'Plugin "search" updated', time: '1 h ago' },
  { title: 'Backup finished', time: '2 h ago' },
  { title: 'Staff role edited', time: '3 h ago' },
  { title: 'Cron job "cleanup" ran', time: '5 h ago' },
  { title: 'Theme "midnight" enabled', time: 'Yesterday' },
  { title: 'Passkey added', time: 'Yesterday' },
  { title: 'Navigation reordered', time: '2 days ago' },
  { title: 'Language "pl" installed', time: '3 days ago' },
  { title: 'Hello world', time: 'Last week' },
]

export default function ScrollFadeVerticalExample() {
  return (
    <section className="not-prose bg-card text-card-foreground flex w-full flex-col rounded-xl border">
      <h3 className="border-b px-4 py-3 text-sm font-medium">Notifications</h3>
      <div className="has-focus-visible:ring-ring/50 rounded-b-xl has-focus-visible:ring-3">
        <ul
          aria-label="Notifications"
          className="scroll-fade flex h-64 flex-col overflow-y-auto overscroll-y-contain px-4 py-2 outline-none"
          role="region"
          tabIndex={0}
        >
          {notifications.map((notification) => (
            <li
              className="flex items-center justify-between gap-4 border-b py-3 text-sm last:border-b-0"
              key={notification.title}
            >
              <span className="truncate">{notification.title}</span>
              <span className="text-muted-foreground shrink-0 text-xs">
                {notification.time}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
