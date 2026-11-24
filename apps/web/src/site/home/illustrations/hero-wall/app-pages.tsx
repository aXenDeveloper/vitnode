import { buttonVariants } from '@vitnode/core/components/ui/button'
import { LogoVitNode } from '@vitnode/core/components/logo-vitnode'
import { cn } from 'cn'
import {
  ArrowLeft,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Crown,
  FileText,
  Flag,
  MessageSquare,
  MessagesSquare,
  Newspaper,
  Puzzle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  SquarePen,
  TriangleAlert,
} from 'lucide-react'

import { usePages } from './pages-copy'

const VIEW =
  'bg-background text-foreground flex h-130 w-240 flex-col overflow-hidden text-left text-sm'

const TONES = [
  'bg-rose-500 text-white',
  'bg-emerald-500 text-white',
  'bg-amber-400 text-amber-950',
  'bg-blue-500 text-white',
]

const SOFT_TONES = [
  'bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300',
]

const CATEGORY_TONES = ['bg-amber-400', 'bg-emerald-500', 'bg-blue-500']

const COVER_TONES = [
  'bg-amber-300 dark:bg-amber-400/40',
  'bg-emerald-300 dark:bg-emerald-400/40',
  'bg-blue-300 dark:bg-blue-400/40',
]

const initialsOf = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')

const Avatar = ({
  className,
  person,
}: {
  className?: string
  person: number
}) => {
  const { people } = usePages()

  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        TONES[person % TONES.length],
        className,
      )}
    >
      {initialsOf(people[person]?.name ?? '')}
    </span>
  )
}

const PersonName = ({ person }: { person: number }) => {
  const { people } = usePages()
  const name = people[person]?.name

  if (person === 0) {
    return (
      <span className="flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400">
        <Crown className="size-3.5" />
        {name}
      </span>
    )
  }

  if (person === 1) {
    return (
      <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
        <ShieldCheck className="size-3.5" />
        {name}
      </span>
    )
  }

  return <span className="font-medium">{name}</span>
}

const Cover = ({ className, tone }: { className?: string; tone: number }) => (
  <span
    className={cn(
      'relative block shrink-0 overflow-hidden rounded-lg',
      COVER_TONES[tone % COVER_TONES.length],
      className,
    )}
  >
    <span className="absolute -top-6 -right-6 size-24 rounded-full bg-white/40 dark:bg-white/10" />
    <span className="absolute -bottom-8 left-6 size-20 rotate-12 rounded-2xl bg-white/30 dark:bg-white/5" />
  </span>
)

const CategoryBadge = ({ category }: { category: number }) => {
  const { blog } = usePages()

  return (
    <span className="flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium">
      <span
        className={cn('size-2.5 rounded-sm', CATEGORY_TONES[category % 3])}
      />
      {blog.categoryNames[category]}
    </span>
  )
}

const NAV_ICONS = [BookOpen, Puzzle, Newspaper, MessagesSquare]

const AppFrame = ({
  active,
  children,
  crumbs,
  id,
  isSignedIn = false,
}: {
  active?: number
  children: React.ReactNode
  crumbs?: string[]
  id: string
  isSignedIn?: boolean
}) => {
  const { nav } = usePages()
  const items = [nav.docs, nav.plugins, nav.blog, nav.community]

  return (
    <div className={VIEW}>
      <div className="px-3 pt-2">
        <div className="bg-card flex h-12 items-center gap-1 rounded-xl border px-4 shadow-sm">
          <LogoVitNode className="mr-3 w-24 shrink-0" idPrefix={`wall-${id}`} />
          {items.map((item, index) => {
            const Icon = NAV_ICONS[index] ?? BookOpen

            return (
              <span
                className={cn(
                  'text-muted-foreground flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 font-medium',
                  index === active && 'bg-muted text-foreground',
                )}
                key={item}
              >
                <Icon className="size-4" />
                {item}
                {index === 3 ? <ChevronDown className="size-3.5" /> : null}
              </span>
            )
          })}
          <span className="text-muted-foreground ml-auto flex h-8 w-44 min-w-24 shrink items-center gap-2 rounded-lg border px-2.5">
            <Search className="size-4 shrink-0" />
            <span className="flex-1 truncate">{nav.search}</span>
            <kbd className="bg-muted rounded px-1.5 font-sans text-xs">⌘K</kbd>
          </span>
          <SlidersHorizontal className="text-muted-foreground mx-2 size-4 shrink-0" />
          {isSignedIn ? (
            <>
              <span className="relative mr-2 flex shrink-0">
                <Bell className="size-4" />
                <span className="absolute -top-2 -right-2 flex size-4 items-center justify-center rounded-full bg-rose-500 text-xs font-semibold text-white">
                  2
                </span>
              </span>
              <Avatar className="size-7" person={0} />
            </>
          ) : (
            <>
              <span className="shrink-0 px-2 font-medium">{nav.login}</span>
              <span className={cn(buttonVariants({ size: 'sm' }), 'shrink-0')}>
                {nav.register}
              </span>
            </>
          )}
        </div>
      </div>
      {crumbs ? (
        <div className="text-muted-foreground flex items-center gap-1.5 px-4 pt-3 text-xs">
          {crumbs.map((crumb, index) => (
            <span className="flex items-center gap-1.5" key={crumb}>
              {index > 0 ? <ChevronRight className="size-3" /> : null}
              <span
                className={cn(
                  index === crumbs.length - 1 && 'text-foreground truncate',
                )}
              >
                {crumb}
              </span>
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-10 py-5">
        {children}
      </div>
    </div>
  )
}

const PageTitle = ({
  action,
  children,
  desc,
}: {
  action?: React.ReactNode
  children: React.ReactNode
  desc?: string
}) => (
  <div className="flex items-end justify-between gap-6">
    <div className="flex min-w-0 flex-col gap-1">
      <span className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
        {children}
      </span>
      {desc ? (
        <span className="text-muted-foreground line-clamp-2">{desc}</span>
      ) : null}
    </div>
    {action}
  </div>
)

const NewTopicButton = () => {
  const { forum } = usePages()

  return (
    <span className={cn(buttonVariants({ size: 'sm' }), 'shrink-0')}>
      <SquarePen />
      {forum.newTopic}
    </span>
  )
}

const ForumIcon = ({ tone }: { tone: number }) => (
  <span
    className={cn(
      'flex size-9 shrink-0 items-center justify-center rounded-lg',
      SOFT_TONES[tone % SOFT_TONES.length],
    )}
  >
    <MessagesSquare className="size-4" />
  </span>
)

const Count = ({ label, value }: { label: string; value: number }) => (
  <span className="flex w-20 shrink-0 flex-col text-xs">
    <span className="text-muted-foreground truncate">{label}</span>
    <span className="font-semibold tabular-nums">{value}</span>
  </span>
)

const FORUM_COUNTS = [
  [12, 86],
  [4, 31],
  [148, 1942],
  [67, 512],
]

export const ForumIndexPage = () => {
  const { forum } = usePages()

  return (
    <AppFrame active={3} crumbs={[forum.title]} id="forum-index">
      <PageTitle action={<NewTopicButton />} desc={forum.desc}>
        {forum.title}
      </PageTitle>
      <ul className="bg-card flex flex-col overflow-hidden rounded-xl border">
        {forum.forums.map(({ desc, latest, name }, index) => (
          <li
            className={cn(
              'flex items-center gap-3 border-b px-4 py-3 last:border-0',
              index === 1 && 'bg-muted/40 pl-10',
            )}
            key={name}
          >
            <ForumIcon tone={index} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">{name}</span>
              {desc ? (
                <span className="text-muted-foreground truncate text-xs">
                  {desc}
                </span>
              ) : null}
            </span>
            <Count label={forum.topics} value={FORUM_COUNTS[index]?.[0] ?? 0} />
            <Count
              label={forum.comments}
              value={FORUM_COUNTS[index]?.[1] ?? 0}
            />
            <span className="flex w-44 shrink-0 flex-col text-xs">
              <span className="text-muted-foreground">{forum.latest}</span>
              <span className="truncate font-medium">{latest}</span>
            </span>
          </li>
        ))}
      </ul>
    </AppFrame>
  )
}

const TOPIC_COMMENTS = [42, 17, 8, 5]

export const ForumPage = () => {
  const { forum } = usePages()
  const name = forum.forums[2]?.name ?? ''

  return (
    <AppFrame active={3} crumbs={[forum.title, name]} id="forum">
      <PageTitle action={<NewTopicButton />}>
        <ForumIcon tone={2} />
        {name}
      </PageTitle>
      <span className="text-base font-semibold">{forum.topics}</span>
      <ul className="bg-card flex flex-col overflow-hidden rounded-xl border">
        {forum.topicsList.map(({ date, title }, index) => (
          <li
            className="flex items-center gap-3 border-b px-4 py-2.5 last:border-0"
            key={title}
          >
            <Avatar person={index} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-semibold">{title}</span>
              <span className="text-muted-foreground flex items-center gap-2 text-xs">
                <PersonName person={index} />
                <span>·</span>
                {date}
              </span>
            </span>
            <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs tabular-nums">
              <MessageSquare className="size-3.5" />
              {TOPIC_COMMENTS[index]}
            </span>
          </li>
        ))}
      </ul>
    </AppFrame>
  )
}

const REACTIONS = [
  { count: 12, emoji: '❤️', isMine: true },
  { count: 7, emoji: '👍', isMine: false },
  { count: 3, emoji: '🎉', isMine: false },
]

const Reactions = () => (
  <span className="flex items-center gap-1.5">
    {REACTIONS.map(({ count, emoji, isMine }) => (
      <span
        className={cn(
          'flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium tabular-nums',
          isMine && 'border-primary/40 bg-primary/10 text-primary',
        )}
        key={emoji}
      >
        <span>{emoji}</span>
        {count}
      </span>
    ))}
  </span>
)

export const TopicPage = () => {
  const { forum, topic } = usePages()
  const forumName = forum.forums[2]?.name ?? ''
  const title = forum.topicsList[0]?.title ?? ''

  return (
    <AppFrame active={3} crumbs={[forum.title, forumName, title]} id="topic">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
        <span className="text-primary text-xs font-medium">{forumName}</span>
        <span className="line-clamp-1 text-2xl font-semibold tracking-tight">
          {title}
        </span>
        <div className="flex items-center gap-3">
          <Avatar person={0} />
          <span className="flex flex-1 flex-col text-xs">
            <PersonName person={0} />
            <span className="text-muted-foreground">{topic.posted}</span>
          </span>
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Flag className="size-3.5" />
            {topic.report}
          </span>
        </div>
        <span className="line-clamp-2 leading-relaxed">{topic.body}</span>
        <Reactions />
        <span className="flex items-center gap-2 pt-1 text-base font-semibold">
          <MessageSquare className="size-4" />
          {topic.commentCount}
        </span>
        {topic.comments.map((comment, index) => (
          <div
            className={cn(
              'flex flex-col gap-1',
              index === 1 && 'ml-4 border-l pl-4',
            )}
            key={comment}
          >
            <span className="flex items-center gap-2 text-xs">
              <Avatar className="size-5" person={index + 1} />
              <PersonName person={index + 1} />
            </span>
            <span className="truncate">{comment}</span>
          </div>
        ))}
      </div>
    </AppFrame>
  )
}

const CATEGORY_COUNTS = [9, 14, 6]

export const BlogIndexPage = () => {
  const { blog } = usePages()

  return (
    <AppFrame active={2} id="blog">
      <PageTitle desc={blog.desc}>{blog.title}</PageTitle>
      <div className="flex min-h-0 gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <span className="text-base font-semibold">{blog.all}</span>
          {blog.articles.map(({ date, title }, index) => (
            <div
              className="bg-card flex items-stretch gap-4 rounded-xl border p-1.5"
              key={title}
            >
              <Cover className="h-24 w-40" tone={index} />
              <span className="flex min-w-0 flex-1 flex-col justify-between gap-2 py-1.5 pr-2">
                <span className="flex flex-col gap-1.5">
                  <CategoryBadge category={index} />
                  <span className="truncate text-base font-semibold">
                    {title}
                  </span>
                </span>
                <span className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Avatar className="size-5" person={index} />
                  <PersonName person={index} />
                  <span>·</span>
                  {date}
                </span>
              </span>
            </div>
          ))}
        </div>
        <div className="flex w-48 shrink-0 flex-col gap-1.5">
          <span className="text-xs font-semibold">{blog.categories}</span>
          <span className="bg-muted flex h-8 items-center gap-2 rounded-lg px-2.5 text-xs font-medium">
            <span className="bg-foreground size-2.5 rounded-sm" />
            <span className="flex-1 truncate">{blog.all}</span>
            <span className="tabular-nums">29</span>
          </span>
          {blog.categoryNames.map((name, index) => (
            <span
              className="text-muted-foreground flex h-8 items-center gap-2 px-2.5 text-xs"
              key={name}
            >
              <span
                className={cn('size-2.5 rounded-sm', CATEGORY_TONES[index])}
              />
              <span className="flex-1 truncate">{name}</span>
              <span className="tabular-nums">{CATEGORY_COUNTS[index]}</span>
            </span>
          ))}
        </div>
      </div>
    </AppFrame>
  )
}

export const ArticlePage = () => {
  const { article, blog } = usePages()
  const first = blog.articles[0]

  return (
    <AppFrame active={2} id="article">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 text-center">
        <span className="text-primary flex items-center gap-1.5 text-xs font-medium">
          <ArrowLeft className="size-3.5" />
          {article.back}
        </span>
        <span className="line-clamp-2 text-2xl leading-tight font-semibold tracking-tight text-balance">
          {first?.title}
        </span>
        <span className="flex items-center gap-2 text-xs">
          <Avatar className="size-5" person={0} />
          <PersonName person={0} />
          <span className="text-muted-foreground">
            {first?.date} · {article.read}
          </span>
        </span>
        <Cover className="h-36 w-full rounded-xl" tone={0} />
        <span className="line-clamp-2 text-left leading-relaxed">
          {article.body}
        </span>
      </div>
    </AppFrame>
  )
}

const DayChip = ({ day, weekday }: { day: number; weekday: string }) => (
  <span className="bg-card flex size-10 shrink-0 flex-col items-center justify-center rounded-lg border border-rose-300 leading-none dark:border-rose-400/40">
    <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
      {weekday}
    </span>
    <span className="text-base font-semibold tabular-nums">{day}</span>
  </span>
)

export const ProfilePage = () => {
  const { forum, people, profile } = usePages()
  const person = people[0]

  return (
    <AppFrame id="profile">
      <div className="bg-card -mx-6 flex flex-col overflow-hidden rounded-xl border">
        <span className="h-24 bg-linear-to-r from-rose-600 to-rose-300" />
        <div className="flex items-end gap-4 px-5 pb-4">
          <Avatar
            className="ring-card -mt-8 size-20 text-2xl ring-4"
            person={0}
          />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5 pt-3">
            <span className="flex items-center gap-2">
              <span className="truncate text-xl font-semibold tracking-tight">
                {person?.name}
              </span>
              <span className="text-muted-foreground text-xs">
                {person?.nick}
              </span>
              <span className="flex items-center gap-1.5 text-xs">
                <span className="size-2 rounded-full bg-emerald-500" />
                {profile.online}
              </span>
            </span>
            <span className="text-muted-foreground flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400">
                <Crown className="size-3.5" />
                {profile.role}
              </span>
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {profile.joined}
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
                {profile.reputation}
              </span>
            </span>
          </span>
        </div>
      </div>
      <span className="text-base font-semibold">{profile.timeline}</span>
      <div className="flex items-center gap-3">
        <DayChip day={24} weekday={profile.weekday} />
        <span className="text-xs font-medium">{profile.today}</span>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="bg-card flex size-10 shrink-0 items-center justify-center rounded-full border text-base">
          ❤️
        </span>
        <PersonName person={0} />
        <span className="text-muted-foreground">{profile.reacted}</span>
        <span className="truncate font-semibold">
          {forum.topicsList[1]?.title}
        </span>
      </div>
    </AppFrame>
  )
}

export const DiscoverPage = () => {
  const { discover, forum, profile, topic } = usePages()

  return (
    <AppFrame id="discover">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
        <PageTitle desc={discover.desc}>{discover.title}</PageTitle>
        <span className="text-base font-semibold">{profile.month}</span>
        <div className="flex items-center gap-3">
          <DayChip day={23} weekday={profile.weekdayBefore} />
          <span className="text-xs font-medium">{profile.yesterday}</span>
        </div>
        {topic.comments.map((comment, index) => (
          <div className="flex items-start gap-3" key={comment}>
            <span className="bg-card text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full border">
              <MessageSquare className="size-3.5" />
            </span>
            <span className="bg-card flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl border px-3 py-2">
              <span className="flex items-center gap-2 text-xs">
                <Avatar className="size-5" person={index + 2} />
                <PersonName person={index + 2} />
                <span className="text-muted-foreground">
                  {discover.commented}
                </span>
                <span className="truncate font-semibold">
                  {forum.topicsList[index]?.title}
                </span>
              </span>
              <span className="truncate border-l-2 pl-2">{comment}</span>
            </span>
          </div>
        ))}
      </div>
    </AppFrame>
  )
}

const KIND_ICONS = [FileText, MessageSquare, MessagesSquare]
const KIND_COUNTS = [3, 36, 6]

export const SearchPage = () => {
  const { blog, search } = usePages()

  return (
    <AppFrame id="search">
      <PageTitle desc={search.desc}>{search.title}</PageTitle>
      <span className="bg-card flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3">
        <Search className="text-muted-foreground size-4" />
        <span className="flex-1 font-medium">{search.placeholder}</span>
        <kbd className="bg-muted text-muted-foreground rounded px-1.5 text-xs">
          /
        </kbd>
      </span>
      <div className="flex min-h-0 gap-8">
        <div className="flex w-44 shrink-0 flex-col gap-2 text-xs">
          <span className="text-sm font-semibold">{search.filters}</span>
          <span className="font-semibold">{search.content}</span>
          {search.kinds.map((kind, index) => {
            const Icon = KIND_ICONS[index] ?? FileText

            return (
              <span className="flex items-center gap-2" key={kind}>
                <span
                  className={cn(
                    'flex size-4 items-center justify-center rounded border',
                    index === 0 &&
                      'bg-primary border-primary text-primary-foreground',
                  )}
                >
                  {index === 0 ? (
                    <Check className="size-3" strokeWidth={3} />
                  ) : null}
                </span>
                <Icon className="text-muted-foreground size-3.5" />
                <span className="flex-1">{kind}</span>
                <span className="text-muted-foreground tabular-nums">
                  {KIND_COUNTS[index]}
                </span>
              </span>
            )
          })}
          <span className="pt-1 font-semibold">{search.date}</span>
          {search.ranges.map((range, index) => (
            <span className="flex items-center gap-2" key={range}>
              <CircleDot
                className={cn(
                  'size-4',
                  index === 0 ? 'text-primary' : 'text-muted-foreground/40',
                )}
              />
              {range}
            </span>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <span className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{search.results}</span>
            <span className="flex h-8 items-center gap-2 rounded-lg border px-2.5 font-medium">
              {search.newest}
              <ChevronDown className="size-3.5" />
            </span>
          </span>
          {blog.articles.map(({ date, title }, index) => (
            <span
              className="bg-card flex items-center gap-3 rounded-xl border p-1.5"
              key={title}
            >
              <Cover className="size-14" tone={index} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate font-semibold">{title}</span>
                <span className="text-muted-foreground flex items-center gap-2 text-xs">
                  <CategoryBadge category={index} />
                  {date}
                </span>
              </span>
            </span>
          ))}
        </div>
      </div>
    </AppFrame>
  )
}

export const PaymentsPage = () => {
  const { payments } = usePages()

  return (
    <AppFrame id="payments" isSignedIn>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <PageTitle desc={payments.desc}>{payments.title}</PageTitle>
        <div className="bg-card flex flex-col overflow-hidden rounded-xl border">
          <div className="flex gap-4 p-4">
            <Cover className="size-20" tone={2} />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-semibold">{payments.item}</span>
              <span className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
                {payments.itemDesc}
              </span>
              <span className="text-xl font-semibold tabular-nums">
                {payments.price}
              </span>
            </span>
          </div>
          <div className="bg-muted/40 flex items-center gap-3 border-t px-4 py-3 text-xs">
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
              <Check className="size-3" />
              {payments.owned}
            </span>
            <span className="font-medium">{payments.view}</span>
          </div>
        </div>
      </div>
    </AppFrame>
  )
}

const MODCP_ICONS = [Flag, ClipboardCheck, TriangleAlert]

const COLUMN_TONES = [
  'bg-muted text-foreground',
  'bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
]

const ReportCard = ({ index }: { index: number }) => {
  const { modcp } = usePages()
  const card = modcp.cards[index]

  return (
    <span className="bg-card flex flex-col gap-1.5 rounded-lg border p-2.5 shadow-sm">
      <span className="flex w-fit items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">
        <Flag className="size-3" />
        {card?.reason}
      </span>
      <span className="line-clamp-2 text-xs leading-snug font-medium">
        {card?.text}
      </span>
      <span className="text-muted-foreground flex items-center justify-between text-xs">
        {card?.kind}
        {index === 2 ? <Avatar className="size-5" person={1} /> : null}
      </span>
    </span>
  )
}

export const ModcpPage = () => {
  const { modcp } = usePages()
  const cardsByColumn = [[0, 1], [2], []]

  return (
    <AppFrame crumbs={[modcp.crumb, modcp.title]} id="modcp" isSignedIn>
      <div className="-mx-6 flex min-h-0 flex-1 gap-6">
        <div className="flex w-40 shrink-0 flex-col gap-1 text-xs">
          {modcp.nav.map((item, index) => {
            const Icon = MODCP_ICONS[index] ?? Flag

            return (
              <span
                className={cn(
                  'text-muted-foreground flex h-8 items-center gap-2 rounded-lg px-2.5',
                  index === 0 && 'bg-muted text-foreground font-medium',
                )}
                key={item}
              >
                <Icon className="size-3.5" />
                <span className="flex-1">{item}</span>
                {index === 0 ? <span className="tabular-nums">8</span> : null}
              </span>
            )
          })}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <PageTitle desc={modcp.desc}>{modcp.title}</PageTitle>
          <div className="grid min-h-0 flex-1 grid-cols-3 gap-3">
            {modcp.columns.map((column, index) => (
              <div className="flex flex-col gap-2" key={column}>
                <span className="flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 font-semibold tracking-wide uppercase',
                      COLUMN_TONES[index],
                    )}
                  >
                    {column}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {index === 0 ? 7 : index === 1 ? 1 : 0}
                  </span>
                </span>
                {cardsByColumn[index]?.map((card) => (
                  <ReportCard index={card} key={card} />
                ))}
                {index === 2 ? (
                  <span className="text-muted-foreground bg-muted/40 rounded-lg py-6 text-center text-xs">
                    {modcp.empty}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppFrame>
  )
}

export const NotificationsPage = () => {
  const { forum, notifications, people } = usePages()

  return (
    <AppFrame active={3} crumbs={[forum.title]} id="notifications" isSignedIn>
      <div className="flex min-h-0 flex-1 gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <PageTitle desc={forum.desc}>{forum.title}</PageTitle>
          <ul className="bg-card flex flex-col overflow-hidden rounded-xl border">
            {forum.forums.slice(0, 3).map(({ name }, index) => (
              <li
                className="flex items-center gap-3 border-b px-4 py-3 last:border-0"
                key={name}
              >
                <ForumIcon tone={index} />
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {name}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-card -mt-3 flex w-80 shrink-0 flex-col gap-2 rounded-xl border p-3 shadow-lg">
          <span className="font-semibold">{notifications.title}</span>
          <span className="bg-muted flex h-8 items-center rounded-lg p-0.5 text-xs font-medium">
            {notifications.tabs.map((tab, index) => (
              <span
                className={cn(
                  'flex h-full flex-1 items-center justify-center rounded-md',
                  index === 0 ? 'bg-card shadow-sm' : 'text-muted-foreground',
                )}
                key={tab}
              >
                {tab}
              </span>
            ))}
          </span>
          {notifications.items.map(({ text, time }, index) => (
            <span
              className="bg-muted/50 flex items-start gap-2.5 rounded-lg p-2.5"
              key={text}
            >
              <Avatar person={index + 1} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-xs">
                <span className="line-clamp-2 leading-snug">
                  <span className="font-semibold">
                    {people[index + 1]?.name}
                  </span>{' '}
                  {text}
                </span>
                <span className="text-muted-foreground">{time}</span>
              </span>
              {index < 2 ? (
                <span className="bg-primary mt-1 size-2 shrink-0 rounded-full" />
              ) : null}
            </span>
          ))}
          <span className="text-muted-foreground mt-auto flex items-center justify-end gap-1.5 text-xs font-medium">
            <CheckCheck className="size-3.5" />
            {notifications.markAll}
          </span>
        </div>
      </div>
    </AppFrame>
  )
}
