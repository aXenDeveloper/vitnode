import { cn } from 'cn'
import { useEffect, useRef } from 'react'

const NEAR_VIEWPORT = '400px 0px'

export const MarketingPage = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current

    if (!root) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.removeAttribute('data-offscreen')
          } else {
            entry.target.setAttribute('data-offscreen', '')
          }
        }
      },
      { rootMargin: NEAR_VIEWPORT },
    )

    for (const section of root.querySelectorAll('section')) {
      observer.observe(section)
    }

    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <div className={cn('font-book flex flex-col', className)} ref={ref}>
      {children}
    </div>
  )
}
