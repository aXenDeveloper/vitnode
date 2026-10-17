import { startTransition, useEffect, useRef, useState } from 'react'

const NEAR_VIEWPORT = '120px 0px'
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

export const useLoopStep = (durations: readonly number[]) => {
  const ref = useRef<HTMLDivElement>(null)
  const lastStep = durations.length - 1
  const [step, setStep] = useState(lastStep)
  const stepRef = useRef(lastStep)

  useEffect(() => {
    const node = ref.current

    if (!node || window.matchMedia(REDUCED_MOTION).matches) return

    let timer: number | undefined

    const stop = () => {
      window.clearTimeout(timer)
      timer = undefined
    }

    const schedule = () => {
      timer = window.setTimeout(() => {
        stepRef.current = (stepRef.current + 1) % durations.length
        const next = stepRef.current

        startTransition(() => {
          setStep(next)
        })
        schedule()
      }, durations[stepRef.current])
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          stop()

          return
        }

        if (timer === undefined) schedule()
      },
      { rootMargin: NEAR_VIEWPORT },
    )

    observer.observe(node)

    return () => {
      observer.disconnect()
      stop()
    }
  }, [durations])

  return { ref, step }
}
