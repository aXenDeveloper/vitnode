import type { LucideIcon } from 'lucide-react'

import {
  Bell,
  Blocks,
  Bot,
  CalendarDays,
  Code,
  Database,
  FileText,
  Globe,
  Image as ImageIcon,
  Languages,
  LayoutDashboard,
  Lock,
  Mail,
  Plug,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
  Users,
  Zap,
} from 'lucide-react'

const ICONS: LucideIcon[] = [
  Bell,
  Blocks,
  Bot,
  CalendarDays,
  Code,
  Database,
  FileText,
  Globe,
  ImageIcon,
  Languages,
  LayoutDashboard,
  Lock,
  Mail,
  Plug,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
  Users,
  Zap,
]

const FIELD = Array.from({ length: 26 }, (_, index) => ({
  Icon: ICONS[index % ICONS.length],
  rotate: ((index * 47) % 30) - 15,
  x: (index * 29.7 + 7) % 96,
  y: (index * 53.3 + 11) % 92,
}))

export const HeroIconField = () => (
  <div
    aria-hidden
    className="pointer-events-none absolute inset-0 -z-10 hidden lg:block"
    style={{
      maskImage:
        'radial-gradient(ellipse 45% 60% at 25% 50%, transparent 45%, black 90%)',
    }}
  >
    {FIELD.map(({ Icon, rotate, x, y }) => (
      <Icon
        className="text-foreground/15 absolute size-5"
        key={`${x}-${y}`}
        strokeWidth={1.5}
        style={{ left: `${x}%`, rotate: `${rotate}deg`, top: `${y}%` }}
      />
    ))}
  </div>
)
