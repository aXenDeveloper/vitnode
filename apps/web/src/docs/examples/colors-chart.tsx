import type { ChartConfig } from '@vitnode/core/components/ui/chart'

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@vitnode/core/components/ui/chart'
import { Bar, BarChart, XAxis } from 'recharts'

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

const SERIES = Object.keys(chartConfig) as (keyof typeof chartConfig)[]

export default function ColorsChart() {
  return (
    <ChartContainer
      className="not-prose aspect-video w-full"
      config={chartConfig}
    >
      <BarChart
        accessibilityLayer
        data={chartData}
        desc="Community activity per weekday across five series"
        title="Community activity"
      >
        <XAxis axisLine={false} dataKey="day" tickLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {SERIES.map((series) => (
          <Bar
            dataKey={series}
            fill={`var(--color-${series})`}
            key={series}
            radius={4}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}
