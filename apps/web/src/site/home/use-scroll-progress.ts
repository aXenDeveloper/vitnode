import { useEffect, useRef } from 'react'

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const useScrollProgress = <T extends HTMLElement>(viewports: number) => {
  const ref = useRef<T>(null)

  useEffect(() => {
    const node = ref.current

    if (!node || prefersReducedMotion()) return

    let frame = 0

    const update = () => {
      frame = 0
      const distance = Math.max(window.innerHeight * viewports, 360)
      const progress = Math.min(Math.max(window.scrollY / distance, 0), 1)
      node.style.setProperty('--progress', progress.toFixed(4))
    }

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [viewports])

  return ref
}
