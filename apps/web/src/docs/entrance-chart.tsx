import type { ChartValue } from '@tanstack/charts'
import type { RendererChartProps } from '@tanstack/charts/react/tooltip'

import { motion } from '@tanstack/charts/motion'
import { RendererChart } from '@tanstack/charts/react/tooltip'
import { useIntersectionObserver } from '@vitnode/core/hooks/use-intersection-observer'
import { cubicBezier } from 'motion/react'
import React from 'react'

const entrance = motion({
  transition: {
    type: 'tween',
    duration: 700,
    easing: cubicBezier(0.22, 1, 0.36, 1),
  },
})

export const EntranceChart = <
  TDatum,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
>(
  props: Omit<RendererChartProps<TDatum, TXValue, TYValue>, 'renderer'>,
) => {
  const [target, setTarget] = React.useState<HTMLDivElement | null>(null)
  const entry = useIntersectionObserver(target, {
    freezeOnceVisible: true,
    threshold: 0.4,
  })

  return (
    <div ref={setTarget} style={{ minHeight: props.height }}>
      {entry?.isIntersecting ? (
        <RendererChart {...props} renderer={entrance} />
      ) : null}
    </div>
  )
}
