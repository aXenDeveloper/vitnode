const SUB_STEP_S = 0.004
const MAX_FRAME_S = 0.064

interface SpringOptions {
  damping?: number
  onUpdate?: (value: number) => void
  precision?: number
  stiffness?: number
}

export interface Spring {
  fling: (target: number, velocity: number) => void
  jump: (value: number) => void
  set: (target: number) => void
  readonly value: number
}

export interface Runtime {
  dispose: () => void
  loop: (el: Element, fn: (elapsed: number, delta: number) => void) => void
  onCleanup: (fn: () => void) => void
  readonly reduced: boolean
  spring: (initial: number, options?: SpringOptions) => Spring
  timeout: (fn: () => void, ms: number) => void
}

export const createRuntime = (): Runtime => {
  const cleanups: (() => void)[] = []
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const onCleanup = (fn: () => void) => {
    cleanups.push(fn)
  }

  const spring = (
    initial: number,
    {
      damping = 26,
      onUpdate,
      precision = 0.01,
      stiffness = 170,
    }: SpringOptions = {},
  ): Spring => {
    let current = initial
    let target = initial
    let velocity = 0
    let frame = 0
    let last = 0

    const tick = (now: number) => {
      let remaining = Math.min((now - last) / 1000, MAX_FRAME_S)

      last = now

      while (remaining > 0) {
        const step = Math.min(remaining, SUB_STEP_S)

        velocity +=
          (-stiffness * (current - target) - damping * velocity) * step
        current += velocity * step
        remaining -= step
      }

      if (
        Math.abs(velocity) < precision &&
        Math.abs(current - target) < precision
      ) {
        current = target
        velocity = 0
        frame = 0
        onUpdate?.(current)

        return
      }

      onUpdate?.(current)
      frame = requestAnimationFrame(tick)
    }

    const wake = () => {
      if (frame) return

      last = performance.now()
      frame = requestAnimationFrame(tick)
    }

    const jump = (value: number) => {
      cancelAnimationFrame(frame)
      frame = 0
      current = value
      target = value
      velocity = 0
      onUpdate?.(current)
    }

    onCleanup(() => {
      cancelAnimationFrame(frame)
    })

    return {
      fling(nextTarget, releaseVelocity) {
        if (reduced) {
          jump(nextTarget)

          return
        }

        target = nextTarget
        velocity = releaseVelocity
        wake()
      },
      jump,
      set(nextTarget) {
        if (reduced) {
          jump(nextTarget)

          return
        }

        target = nextTarget
        wake()
      },
      get value() {
        return current
      },
    }
  }

  const loop: Runtime['loop'] = (el, fn) => {
    let frame = 0
    let last = 0
    let elapsed = 0
    let inView = false
    let running = false

    const tick = (now: number) => {
      const delta = last ? Math.min(now - last, 64) : 0

      last = now
      elapsed += delta
      fn(elapsed, delta)
      frame = requestAnimationFrame(tick)
    }

    const sync = () => {
      const next = inView && !document.hidden

      if (next === running) return

      running = next
      cancelAnimationFrame(frame)
      last = 0
      if (running) frame = requestAnimationFrame(tick)
    }

    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      sync()
    })

    observer.observe(el)
    document.addEventListener('visibilitychange', sync)
    onCleanup(() => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', sync)
      cancelAnimationFrame(frame)
    })
  }

  const timeout = (fn: () => void, ms: number) => {
    const timer = window.setTimeout(fn, ms)

    onCleanup(() => {
      window.clearTimeout(timer)
    })
  }

  return {
    dispose() {
      for (const fn of cleanups.splice(0)) fn()
    },
    loop,
    onCleanup,
    reduced,
    spring,
    timeout,
  }
}
