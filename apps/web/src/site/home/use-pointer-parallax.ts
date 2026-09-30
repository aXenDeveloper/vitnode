import { useRef } from 'react'

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const usePointerParallax = <T extends HTMLElement>() => {
  const targetRef = useRef<T>(null)
  const frameRef = useRef(0)

  const setOffset = (x: number, y: number) => {
    cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(() => {
      targetRef.current?.style.setProperty('--px', `${x}`)
      targetRef.current?.style.setProperty('--py', `${y}`)
    })
  }

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse' || prefersReducedMotion()) return

    const bounds = event.currentTarget.getBoundingClientRect()

    setOffset(
      -((event.clientX - bounds.left) / bounds.width - 0.5) * 2,
      -((event.clientY - bounds.top) / bounds.height - 0.5) * 2,
    )
  }

  const onPointerLeave = () => {
    setOffset(0, 0)
  }

  return { handlers: { onPointerLeave, onPointerMove }, targetRef }
}
