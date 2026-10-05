import type { ChartConfig } from '@vitnode/core/components/ui/chart'

import { defineChart } from '@tanstack/charts'
import { pie, polar, radialArc } from '@tanstack/charts/polar'
import { Chart } from '@tanstack/charts/react/tooltip'
import { tooltip } from '@tanstack/charts/tooltip'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@vitnode/core/components/ui/card'
import {
  chartColor,
  ChartContainer,
  ChartLegend,
  ChartTooltipContent,
} from '@vitnode/core/components/ui/chart'

const chartData = [
  { category: 'general', threads: 412 },
  { category: 'support', threads: 286 },
  { category: 'offTopic', threads: 173 },
  { category: 'plugins', threads: 139 },
]

const chartConfig = {
  threads: { label: 'Threads' },
  general: { label: 'General', color: 'var(--chart-1)' },
  support: { label: 'Support', color: 'var(--chart-2)' },
  offTopic: { label: 'Off-topic', color: 'var(--chart-3)' },
  plugins: { label: 'Plugins', color: 'var(--chart-4)' },
} satisfies ChartConfig

const definition = defineChart({
  marks: [
    polar({
      inset: 8,
      marks: [
        radialArc(pie(chartData, { value: 'threads' }), {
          innerRadius: ({ radius }) => radius * 0.5,
          cornerRadius: 4,
          color: 'category',
          key: 'category',
        }),
      ],
      scales: { angle: null, radius: null },
    }),
  ],
  scales: { x: null, y: null },
  color: chartColor(chartConfig),
  tooltip,
  svgAnimation: true,
})

export default function ChartPieExample() {
  return (
    <Card className="not-prose w-full">
      <CardHeader>
        <CardTitle>Threads by category</CardTitle>
        <CardDescription>Last 30 days</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <Chart
            ariaDescription="Share of new forum threads per category in the last 30 days"
            ariaLabel="Threads by category"
            definition={definition}
            height={260}
            renderTooltipBody={({ points }) => (
              <ChartTooltipContent
                hideLabel
                nameKey="category"
                points={points}
                valueKey="threads"
              />
            )}
          />
          <ChartLegend />
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
