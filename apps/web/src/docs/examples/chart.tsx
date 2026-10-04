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
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'

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

export default function ChartExample() {
  return (
    <Card className="not-prose w-full">
      <CardHeader>
        <CardTitle>Visitors</CardTitle>
        <CardDescription>January - June 2026</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          className="aspect-4/3 sm:aspect-video"
          config={chartConfig}
        >
          <BarChart
            accessibilityLayer
            data={chartData}
            desc="Desktop and mobile visitors per month, January to June 2026"
            title="Visitors"
          >
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="month"
              tickFormatter={shortMonth}
              tickLine={false}
              tickMargin={10}
            />
            <ChartTooltip
              content={<ChartTooltipContent indicator="dashed" />}
              cursor={false}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
            <Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
