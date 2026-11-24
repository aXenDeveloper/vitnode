import { startTransition, useEffect, useRef, useState } from 'react'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

export const useWordRotation = (count: number, holdMs: number) => {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<{
    index: number
    previous: null | number
  }>({ index: 0, previous: null })
  const control = useRef({ isHovered: false, sync: () => {} })

  useEffect(() => {
    const node = ref.current

    if (!node || window.matchMedia(REDUCED_MOTION).matches) return

    const handle = control.current
    let timer: number | undefined
    let isVisible = false

    const stop = () => {
      window.clearTimeout(timer)
      timer = undefined
    }

    const schedule = () => {
      timer = window.setTimeout(() => {
        startTransition(() => {
          setState(({ index }) => ({
            index: (index + 1) % count,
            previous: index,
          }))
        })
        schedule()
      }, holdMs)
    }

    const sync = () => {
      if (!isVisible || handle.isHovered || document.hidden) {
        stop()

        return
      }

      if (timer === undefined) schedule()
    }

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry?.isIntersecting ?? false
      sync()
    })

    handle.sync = sync
    observer.observe(node)
    document.addEventListener('visibilitychange', sync)

    return () => {
      handle.sync = () => {}
      observer.disconnect()
      document.removeEventListener('visibilitychange', sync)
      stop()
    }
  }, [count, holdMs])

  const hoverProps = {
    onPointerEnter: () => {
      control.current.isHovered = true
      control.current.sync()
    },
    onPointerLeave: () => {
      control.current.isHovered = false
      control.current.sync()
    },
  }

  return { hoverProps, ref, state }
}
