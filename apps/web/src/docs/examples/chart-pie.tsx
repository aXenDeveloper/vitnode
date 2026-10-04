import type { ChartConfig } from '@vitnode/core/components/ui/chart'

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
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@vitnode/core/components/ui/chart'
import { Pie, PieChart } from 'recharts'

const chartData = [
  { category: 'general', threads: 412, fill: 'var(--color-general)' },
  { category: 'support', threads: 286, fill: 'var(--color-support)' },
  { category: 'offTopic', threads: 173, fill: 'var(--color-offTopic)' },
  { category: 'plugins', threads: 139, fill: 'var(--color-plugins)' },
]

const chartConfig = {
  threads: { label: 'Threads' },
  general: { label: 'General', color: 'var(--chart-1)' },
  support: { label: 'Support', color: 'var(--chart-2)' },
  offTopic: { label: 'Off-topic', color: 'var(--chart-3)' },
  plugins: { label: 'Plugins', color: 'var(--chart-4)' },
} satisfies ChartConfig

export default function ChartPieExample() {
  return (
    <Card className="not-prose w-full">
      <CardHeader>
        <CardTitle>Threads by category</CardTitle>
        <CardDescription>Last 30 days</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          className="mx-auto aspect-square max-h-72"
          config={chartConfig}
        >
          <PieChart
            accessibilityLayer
            desc="Share of new forum threads per category in the last 30 days"
            title="Threads by category"
          >
            <ChartTooltip
              content={<ChartTooltipContent hideLabel nameKey="category" />}
            />
            <Pie
              data={chartData}
              dataKey="threads"
              innerRadius="50%"
              nameKey="category"
            />
            <ChartLegend
              content={
                <ChartLegendContent className="flex-wrap" nameKey="category" />
              }
              itemSorter={null}
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
