import type { ChartConfig } from '@vitnode/core/components/ui/chart'

import { barY, defineChart, group } from '@tanstack/charts'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { tooltip } from '@tanstack/charts/tooltip'
import { fold } from '@tanstack/charts/transform/fold'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@vitnode/core/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartTooltipContent,
} from '@vitnode/core/components/ui/chart'
import {
  chartColor,
  chartTooltipMotion,
} from '@vitnode/core/components/ui/chart-utils'

import { EntranceChart } from '../entrance-chart'

const chartData = [
  { month: 'January', desktop: 186, mobile: 80 },
  { month: 'February', desktop: 305, mobile: 200 },
  { month: 'March', desktop: 237, mobile: 120 },
  { month: 'April', desktop: 73, mobile: 190 },
  { month: 'May', desktop: 209, mobile: 130 },
  { month: 'June', desktop: 214, mobile: 140 },
]

const chartConfig = {
  desktop: {
    label: 'Desktop',
    color: 'var(--chart-1)',
  },
  mobile: {
    label: 'Mobile',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig

const shortMonth = (month: string) => month.slice(0, 3)

const rows = fold(chartData, {
  fields: ['desktop', 'mobile'] as const,
  as: { key: 'device', value: 'visitors' },
})

const definition = defineChart({
  marks: [
    barY(rows, {
      x: 'month',
      y: 'visitors',
      color: 'device',
      layout: group({ padding: 0.1 }),
      radius: 4,
    }),
  ],
  scales: {
    x: {
      scale: () => scaleBand().padding(0.2),
      axis: { line: false, ticks: { size: 0, format: shortMonth } },
    },
    y: { scale: scaleLinear, nice: true, grid: true, axis: false },
  },
  color: chartColor(chartConfig),
  focus: 'group-x',
  tooltip: {
    use: tooltip,
    anchor: 'group-center',
    sort: 'color-domain',
    motion: chartTooltipMotion,
  },
})

export default function ChartExample() {
  return (
    <Card className="not-prose w-full">
      <CardHeader>
        <CardTitle>Visitors</CardTitle>
        <CardDescription>January - June 2026</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <EntranceChart
            ariaDescription="Desktop and mobile visitors per month, January to June 2026"
            ariaLabel="Visitors"
            definition={definition}
            height={280}
            renderTooltipBody={({ points }) => (
              <ChartTooltipContent indicator="dashed" points={points} />
            )}
          />
          <ChartLegend />
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
