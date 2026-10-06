import type { ChartConfig } from '@vitnode/core/components/ui/chart'

import { defineChart, lineY } from '@tanstack/charts'
import { crosshair } from '@tanstack/charts/crosshair'
import { d3Curve } from '@tanstack/charts/d3/shape'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scalePoint } from '@tanstack/charts/scales/point'
import { tooltip } from '@tanstack/charts/tooltip'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@vitnode/core/components/ui/card'
import {
  ChartContainer,
  ChartTooltipContent,
} from '@vitnode/core/components/ui/chart'
import { chartTooltipMotion } from '@vitnode/core/components/ui/chart-utils'
import { curveMonotoneX } from 'd3-shape'

import { EntranceChart } from '../entrance-chart'

const chartData = [
  { day: 'Monday', responseTime: 182 },
  { day: 'Tuesday', responseTime: 164 },
  { day: 'Wednesday', responseTime: 210 },
  { day: 'Thursday', responseTime: 148 },
  { day: 'Friday', responseTime: 126 },
  { day: 'Saturday', responseTime: 98 },
  { day: 'Sunday', responseTime: 104 },
]

const chartConfig = {
  responseTime: {
    label: 'Response time',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig

const shortDay = (day: string) => day.slice(0, 3)

const definition = defineChart({
  marks: [
    crosshair({
      x: true,
      y: false,
      motion: { transition: chartTooltipMotion },
    }),
    lineY(chartData, {
      x: 'day',
      y: 'responseTime',
      stroke: 'var(--color-responseTime)',
      strokeWidth: 2,
      points: true,
      curve: d3Curve(curveMonotoneX),
    }),
  ],
  scales: {
    x: {
      scale: () => scalePoint().padding(0.3),
      axis: { line: false, ticks: { size: 0, format: shortDay } },
    },
    y: { scale: scaleLinear, nice: true, grid: true, axis: false },
  },
  focus: 'nearest-x',
  maxFocusDistance: Number.POSITIVE_INFINITY,
  tooltip: { use: tooltip, motion: chartTooltipMotion },
})

export default function ChartLineExample() {
  return (
    <Card className="not-prose w-full">
      <CardHeader>
        <CardTitle>API response time</CardTitle>
        <CardDescription>Median in milliseconds, last week</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <EntranceChart
            ariaDescription="Median API response time in milliseconds per day, Monday to Sunday"
            ariaLabel="API response time"
            definition={definition}
            height={280}
            renderTooltipBody={({ points }) => (
              <ChartTooltipContent
                indicator="line"
                nameKey="responseTime"
                points={points}
              />
            )}
          />
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
