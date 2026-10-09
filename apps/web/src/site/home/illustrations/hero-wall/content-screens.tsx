import { Badge } from '@vitnode/core/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@vitnode/core/components/ui/card'
import { Input } from '@vitnode/core/components/ui/input'
import { Textarea } from '@vitnode/core/components/ui/textarea'
import { cn } from 'cn'
import {
  ArrowLeft,
  Bold,
  ChevronRight,
  FileImage,
  FileText,
  Globe,
  GripVertical,
  Heart,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  MessageSquare,
  NotebookPen,
  Pencil,
  Plus,
  Redo2,
  Save,
  Send,
  TriangleAlert,
  Underline,
  Undo2,
  Upload,
} from 'lucide-react'
import { useTranslations } from 'use-intl'

import { AdminFrame } from './frames'
import { Field, LanguageInput, ListRow, StaticButton } from './parts'

export const DashboardScreen = () => {
  const t = useTranslations('site.home.hero.wall.dashboard')

  return (
    <AdminFrame
      actions={
        <StaticButton>
          <Pencil />
          {t('edit_layout')}
        </StaticButton>
      }
      badge={
        <Badge variant="warning">
          <TriangleAlert />
          {t('dev_mode')}
        </Badge>
      }
      description={t('version', { version: '2.0.0-canary.4' })}
      page="dashboard"
      title="VitNode"
    >
      <div className="grid grid-cols-5 items-start gap-4">
        <Card className="col-span-2" size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <NotebookPen className="size-4" />
              {t('notes_title')}
            </CardTitle>
            <CardDescription>{t('notes_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              className="min-h-24"
              placeholder={t('notes_placeholder')}
              readOnly
            />
          </CardContent>
        </Card>
        <Card className="col-span-3" size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="size-4" />
              {t('notify_title')}
            </CardTitle>
            <CardDescription>{t('notify_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end gap-2">
            <Field label={t('user_id')}>
              <Input className="w-16" readOnly value="1" />
            </Field>
            <div className="min-w-0 flex-1">
              <Field label={t('message')}>
                <Input readOnly value={t('message_value')} />
              </Field>
            </div>
            <StaticButton size="default" variant="default">
              <Send />
              {t('send')}
            </StaticButton>
          </CardContent>
        </Card>
      </div>
    </AdminFrame>
  )
}

const TOOLBAR = [
  { Icon: Undo2, key: 'undo' },
  { Icon: Redo2, key: 'redo' },
  { Icon: Bold, key: 'bold' },
  { Icon: Italic, key: 'italic' },
  { Icon: Underline, key: 'underline' },
  { Icon: List, key: 'list' },
  { Icon: ListOrdered, key: 'ordered' },
]

export const ArticleScreen = () => {
  const t = useTranslations('site.home.hero.wall.article')

  return (
    <AdminFrame
      actions={
        <>
          <StaticButton>
            <ArrowLeft />
            {t('back')}
          </StaticButton>
          <StaticButton>
            <Save />
            {t('draft')}
          </StaticButton>
          <StaticButton variant="default">
            <Send />
            {t('publish')}
          </StaticButton>
        </>
      }
      description={t('desc')}
      page="articles"
      title={t('title')}
    >
      <div className="grid grid-cols-3 items-start gap-4">
        <Card className="col-span-2" size="sm">
          <CardContent className="flex flex-col gap-4">
            <Field label={t('title_label')}>
              <LanguageInput value={t('title_value')} />
            </Field>
            <Field label={t('url')} optional>
              <LanguageInput value="summer-meetup-recap" />
            </Field>
            <Field label={t('content')}>
              <div className="bg-card overflow-hidden rounded-md border">
                <div className="text-muted-foreground flex items-center gap-3 border-b px-3 py-2">
                  {TOOLBAR.map(({ Icon, key }) => (
                    <Icon className="size-4" key={key} />
                  ))}
                </div>
                <p className="p-3 text-sm leading-relaxed">
                  {t('content_value')}
                </p>
              </div>
            </Field>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>{t('cover')}</CardTitle>
            <CardDescription>{t('cover_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed p-4 text-sm">
              <Upload className="size-4" />
              {t('drop')}
              <StaticButton size="xs">{t('choose')}</StaticButton>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminFrame>
  )
}

const CATEGORIES = [
  { color: 'bg-primary', count: 24, key: 'announcements' },
  { color: 'bg-emerald-500', count: 61, key: 'guides' },
  { color: 'bg-amber-400', count: 17, key: 'spotlight' },
  { color: 'bg-red-500', count: 9, key: 'releases' },
  { color: 'bg-sky-500', count: 33, key: 'events' },
] as const

export const CategoriesScreen = () => {
  const t = useTranslations('site.home.hero.wall')

  return (
    <AdminFrame
      actions={
        <StaticButton variant="default">
          <Plus />
          {t('categories.create')}
        </StaticButton>
      }
      description={t('categories.desc')}
      page="categories"
      title={t('nav.categories')}
    >
      <Card className="py-0" size="sm">
        {CATEGORIES.map(({ color, count, key }) => (
          <ListRow key={key}>
            <GripVertical className="text-muted-foreground size-4" />
            <span className={cn('size-2.5 rounded-full', color)} />
            <span className="flex-1 text-sm font-medium">
              {t(`categories.${key}`)}
            </span>
            <span className="text-muted-foreground text-sm tabular-nums">
              {t('categories.count', { count })}
            </span>
            <ChevronRight className="text-muted-foreground size-4" />
          </ListRow>
        ))}
      </Card>
    </AdminFrame>
  )
}

const LINKS = [
  { child: false, Icon: Globe, label: 'home', url: '/' },
  { child: false, Icon: FileText, label: 'blog', url: '/blog' },
  {
    child: true,
    Icon: FileText,
    label: 'announcements',
    url: '/blog/announcements',
  },
  { child: true, Icon: FileText, label: 'guides', url: '/blog/guides' },
  {
    child: false,
    Icon: MessageSquare,
    label: 'discord',
    url: 'discord.gg/vitnode',
  },
  { child: false, Icon: Heart, label: 'support', url: '/donate' },
] as const

export const NavigationScreen = () => {
  const t = useTranslations('site.home.hero.wall')
  const label = (key: (typeof LINKS)[number]['label']) => {
    if (key === 'blog') return t('nav.blog')
    if (key === 'announcements' || key === 'guides')
      return t(`categories.${key}`)

    return t(`navigation.${key}`)
  }

  return (
    <AdminFrame
      actions={
        <StaticButton>
          <Plus />
          {t('navigation.add')}
        </StaticButton>
      }
      description={t('navigation.desc')}
      page="navigation"
      title={t('nav.navigation')}
    >
      <div className="flex flex-col gap-2">
        {LINKS.map(({ child, Icon, label: key, url }) => (
          <div
            className={cn(
              'bg-card flex items-center gap-3 rounded-lg border px-3 py-2.5 shadow-xs',
              child && 'ml-8',
            )}
            key={key}
          >
            <GripVertical className="text-muted-foreground size-4" />
            <Icon className="size-4" />
            <span className="text-sm font-medium">{label(key)}</span>
            <span className="text-muted-foreground flex items-center gap-1 font-mono text-xs">
              <Link2 className="size-3" />
              {url}
            </span>
          </div>
        ))}
      </div>
    </AdminFrame>
  )
}

const FILES = [
  {
    Icon: ImageIcon,
    name: 'summer-meetup.webp',
    size: '412 KB',
    tint: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  },
  {
    Icon: ImageIcon,
    name: 'avatar-maya.png',
    size: '86 KB',
    tint: 'bg-amber-400/20 text-amber-700 dark:text-amber-300',
  },
  {
    Icon: FileText,
    name: 'community-guidelines.pdf',
    size: '1.2 MB',
    tint: 'bg-red-500/15 text-red-600 dark:text-red-400',
  },
  {
    Icon: FileImage,
    name: 'cover-release-notes.avif',
    size: '233 KB',
    tint: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  },
  {
    Icon: ImageIcon,
    name: 'banner-events.webp',
    size: '540 KB',
    tint: 'bg-primary/15 text-primary',
  },
  {
    Icon: FileText,
    name: 'press-kit.zip',
    size: '8.4 MB',
    tint: 'bg-muted text-muted-foreground',
  },
]

export const FilesScreen = () => {
  const t = useTranslations('site.home.hero.wall')

  return (
    <AdminFrame
      actions={
        <StaticButton variant="default">
          <Upload />
          {t('files.upload')}
        </StaticButton>
      }
      description={t('files.desc')}
      page="files"
      title={t('nav.files')}
    >
      <div className="grid grid-cols-3 gap-3">
        {FILES.map(({ Icon, name, size, tint }) => (
          <Card className="gap-3 pt-0" key={name} size="sm">
            <span className={cn('flex h-20 items-center justify-center', tint)}>
              <Icon className="size-6" />
            </span>
            <CardContent className="flex flex-col">
              <span className="truncate text-sm font-medium">{name}</span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {size}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminFrame>
  )
}
