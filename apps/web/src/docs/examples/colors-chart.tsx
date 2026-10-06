import type { ChartConfig } from '@vitnode/core/components/ui/chart'

import { barY, defineChart, group } from '@tanstack/charts'
import { Chart } from '@tanstack/charts/react/tooltip'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { tooltip } from '@tanstack/charts/tooltip'
import { fold } from '@tanstack/charts/transform/fold'
import {
  ChartContainer,
  ChartLegend,
  ChartTooltipContent,
} from '@vitnode/core/components/ui/chart'
import { chartColor } from '@vitnode/core/components/ui/chart-utils'

const chartData = [
  { day: 'Mon', posts: 42, replies: 64, likes: 30, signups: 18, reports: 4 },
  { day: 'Tue', posts: 51, replies: 72, likes: 41, signups: 22, reports: 6 },
  { day: 'Wed', posts: 38, replies: 59, likes: 35, signups: 16, reports: 3 },
  { day: 'Thu', posts: 60, replies: 81, likes: 48, signups: 27, reports: 5 },
  { day: 'Fri', posts: 47, replies: 70, likes: 44, signups: 20, reports: 7 },
]

const chartConfig = {
  posts: { label: 'Posts', color: 'var(--chart-1)' },
  replies: { label: 'Replies', color: 'var(--chart-2)' },
  likes: { label: 'Likes', color: 'var(--chart-3)' },
  signups: { label: 'Sign-ups', color: 'var(--chart-4)' },
  reports: { label: 'Reports', color: 'var(--chart-5)' },
} satisfies ChartConfig

const rows = fold(chartData, {
  fields: ['posts', 'replies', 'likes', 'signups', 'reports'] as const,
  as: { key: 'series', value: 'count' },
})

const definition = defineChart({
  marks: [
    barY(rows, {
      x: 'day',
      y: 'count',
      color: 'series',
      layout: group({ padding: 0.1 }),
      radius: 4,
    }),
  ],
  scales: {
    x: {
      scale: () => scaleBand().padding(0.2),
      axis: { line: false, ticks: { size: 0 } },
    },
    y: { scale: scaleLinear, nice: true, axis: false },
  },
  color: chartColor(chartConfig),
  focus: 'group-x',
  tooltip: { use: tooltip, anchor: 'group-center', sort: 'color-domain' },
})

export default function ColorsChart() {
  return (
    <ChartContainer className="not-prose" config={chartConfig}>
      <Chart
        ariaDescription="Community activity per weekday across five series"
        ariaLabel="Community activity"
        definition={definition}
        height={280}
        renderTooltipBody={({ points }) => (
          <ChartTooltipContent points={points} />
        )}
      />
      <ChartLegend />
    </ChartContainer>
  )
}
