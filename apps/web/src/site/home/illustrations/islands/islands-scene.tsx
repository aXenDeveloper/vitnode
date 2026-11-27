import { Button } from '@vitnode/core/components/ui/button'
import { cn } from 'cn'
import { Link2, Plus, Unlink, Users } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslations } from 'use-intl'

import {
  ISLAND_PARTS,
  type IslandPart,
  type IslandsCopy,
  startIslands,
} from './engine'

type Vars = React.CSSProperties & Record<`--${string}`, number | string>

const vars = (values: Record<string, number | string>) =>
  Object.fromEntries(
    Object.entries(values).map(([key, value]) => [`--${key}`, value]),
  ) as Vars

const SIZE: Record<IslandPart, { d: number; h: number; w: number }> = {
  blog: { d: 0.36, h: 0.78, w: 0.36 },
  booking: { d: 0.4, h: 0.94, w: 0.4 },
  forum: { d: 0.48, h: 0.32, w: 0.66 },
  members: { d: 0.48, h: 0.42, w: 0.56 },
  payments: { d: 0.46, h: 0.4, w: 0.62 },
  shop: { d: 0.46, h: 0.28, w: 0.64 },
}

const CLOUDS = [
  { cs: 1, cx: '-4%', cy: '-2%' },
  { cs: 0.8, cx: 'calc(50% - 3.6rem)', cy: '-4%' },
  { cs: 1.1, cx: 'calc(100% - 9rem)', cy: 'calc(100% - 3.5rem)' },
]

const Windows = ({
  cols,
  count,
  kind,
  rows,
}: {
  cols: number
  count: number
  kind?: 'arch' | 'cal' | 'col' | 'front' | 'line' | 'wide'
  rows: number
}) => (
  <div
    className={cn('mk-isles-win', kind && `mk-isles-win-${kind}`)}
    style={vars({ c: cols, r: rows })}
  >
    {Array.from({ length: count }, (_, k) => (
      <i key={k} style={vars({ k })} />
    ))}
  </div>
)

const Door = ({ edge }: { edge?: 'end' | 'start' }) => (
  <b className={cn('mk-isles-door', edge && `mk-isles-door-${edge}`)} />
)

const BUILDINGS: Record<
  IslandPart,
  { roof: React.ReactNode; south: React.ReactNode; west: React.ReactNode }
> = {
  blog: {
    roof: (
      <div className="mk-isles-drop mk-isles-flat">
        <i className="mk-isles-page" />
      </div>
    ),
    south: (
      <>
        <Windows cols={1} count={5} kind="line" rows={5} />
        <Door />
      </>
    ),
    west: <Windows cols={1} count={5} kind="line" rows={5} />,
  },
  booking: {
    roof: (
      <div className="mk-isles-drop mk-isles-flat">
        <i className="mk-isles-cap" />
      </div>
    ),
    south: (
      <>
        <i className="mk-isles-clock" />
        <Windows cols={2} count={6} rows={3} />
      </>
    ),
    west: (
      <>
        <Windows cols={3} count={12} kind="cal" rows={4} />
        <Door />
      </>
    ),
  },
  forum: {
    roof: (
      <div className="mk-isles-board">
        <div className="mk-isles-drop">
          <i className="mk-isles-bubble" />
        </div>
      </div>
    ),
    south: (
      <>
        <Windows cols={3} count={3} kind="wide" rows={1} />
        <Door edge="end" />
      </>
    ),
    west: <Windows cols={2} count={2} kind="wide" rows={1} />,
  },
  members: {
    roof: null,
    south: <Windows cols={2} count={2} kind="arch" rows={1} />,
    west: (
      <>
        <Windows cols={1} count={1} kind="arch" rows={1} />
        <Door />
      </>
    ),
  },
  payments: {
    roof: (
      <div className="mk-isles-board">
        <div className="mk-isles-drop">
          <i className="mk-isles-coin" />
        </div>
      </div>
    ),
    south: (
      <>
        <Windows cols={2} count={2} kind="col" rows={1} />
        <Door />
        <Windows cols={2} count={2} kind="col" rows={1} />
      </>
    ),
    west: <Windows cols={3} count={3} kind="col" rows={1} />,
  },
  shop: {
    roof: (
      <div className="mk-isles-drop mk-isles-flat">
        <i className="mk-isles-sign" />
      </div>
    ),
    south: <Windows cols={1} count={1} kind="front" rows={1} />,
    west: (
      <>
        <Door edge="start" />
        <Windows cols={1} count={1} kind="wide" rows={1} />
      </>
    ),
  },
}

const IslandBase = ({ children }: { children?: React.ReactNode }) => (
  <>
    <div className="mk-isles-under" />
    <div className="mk-isles-side mk-isles-side-s" />
    <div className="mk-isles-side mk-isles-side-w" />
    <div className="mk-isles-grass">{children}</div>
  </>
)

export const IslandsScene = ({ className }: { className?: string }) => {
  const t = useTranslations('site.home.hero.scene')
  const root = useRef<HTMLDivElement>(null)

  const names = useMemo(
    () =>
      Object.fromEntries(
        ISLAND_PARTS.map((part) => [part, t(`parts.${part}`)]),
      ) as Record<IslandPart, string>,
    [t],
  )

  const copy = useMemo<IslandsCopy>(
    () => ({
      all: { off: t('all.off'), on: t('all.on') },
      bridge: (name) => t('bridge', { name }),
      captions: {
        blog: t('captions.blog'),
        booking: t('captions.booking'),
        forum: t('captions.forum'),
        members: t('captions.members'),
        payments: t('captions.payments'),
        people: t('captions.people'),
        shop: t('captions.shop'),
      },
      clearSkies: t('clear_skies'),
      cut: t('cut'),
      home: t('home'),
      lowered: t('lowered'),
      names,
      react: {
        cloud: t('react.cloud'),
        flock: t('react.flock'),
        plank: t('react.plank'),
        walker: t('react.walker'),
      },
    }),
    [names, t],
  )

  useEffect(() => {
    const el = root.current

    if (!el) return

    return startIslands(el, copy, {
      skipIntro: 'heroSeen' in document.documentElement.dataset,
    })
  }, [copy])

  return (
    <div
      className={cn('mk-isles flex min-w-0 flex-col gap-3', className)}
      ref={root}
    >
      <div className="mk-isles-scene">
        <div className="mk-isles-clouds">
          {CLOUDS.map((cloud) => (
            <span className="mk-isles-cloud" key={cloud.cx} style={vars(cloud)}>
              <i />
            </span>
          ))}
        </div>

        <div aria-hidden className="mk-isles-stage">
          <div className="mk-isles-iso">
            <div className="mk-isles-planks" />
            <div className="mk-isles-island mk-isles-island-home">
              <div className="mk-isles-isle">
                <IslandBase>
                  <div className="mk-isles-crowd" />
                </IslandBase>
              </div>
            </div>

            {ISLAND_PARTS.map((part) => {
              const building = BUILDINGS[part]

              return (
                <div
                  className="mk-isles-island"
                  data-part={part}
                  key={part}
                  style={vars(SIZE[part])}
                >
                  <div className="mk-isles-isle">
                    <IslandBase />
                    <div className="mk-isles-ring">
                      <i />
                    </div>
                    <div className="mk-isles-flagpost">
                      <div className="mk-isles-flagboard">
                        <i className="mk-isles-pole" />
                        <i className="mk-isles-flag" />
                      </div>
                    </div>
                    <div className="mk-isles-bld">
                      <div className="mk-isles-wall mk-isles-wall-w">
                        <div className="mk-isles-face">{building.west}</div>
                      </div>
                      <div className="mk-isles-wall mk-isles-wall-s">
                        <div className="mk-isles-face">{building.south}</div>
                      </div>
                      {part === 'shop' ? (
                        <div className="mk-isles-awning" />
                      ) : null}
                      <div className="mk-isles-top">{building.roof}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mk-isles-ground">
            {ISLAND_PARTS.map((part) => (
              <div className="mk-isles-spot" data-part={part} key={part}>
                <i />
              </div>
            ))}
          </div>
        </div>

        <canvas aria-hidden className="mk-isles-walk" />

        <div className="mk-isles-chips">
          <span aria-hidden className="mk-isles-chip mk-isles-chip-home">
            <span className="mk-isles-chip-in">
              <Users aria-hidden />
              {t('home')}
            </span>
          </span>
          {ISLAND_PARTS.map((part) => (
            <span className="mk-isles-chip" data-part={part} key={part}>
              <button
                aria-pressed="false"
                className="mk-isles-chip-in mk-isles-key"
                data-part={part}
                type="button"
              >
                <Plus aria-hidden className="mk-isles-chip-plus" />
                {names[part]}
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <p aria-live="polite" className="sr-only" role="status">
          <span className="mk-isles-caption-title">{t('home')}</span>{' '}
          <span className="mk-isles-caption-text">{t('captions.people')}</span>
        </p>
        <Button
          aria-pressed="false"
          className="mk-isles-all h-11 shrink-0 rounded-xl px-5 text-base"
          variant="outline"
        >
          <Link2 aria-hidden className="group-aria-pressed/button:hidden" />
          <Unlink
            aria-hidden
            className="hidden group-aria-pressed/button:block"
          />
          <span className="mk-isles-all-label">{t('all.off')}</span>
        </Button>
      </div>
    </div>
  )
}
