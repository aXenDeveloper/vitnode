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
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'

const chartData = [
  { month: 'January', downloads: 420, upgrades: 120 },
  { month: 'February', downloads: 610, upgrades: 180 },
  { month: 'March', downloads: 530, upgrades: 260 },
  { month: 'April', downloads: 780, upgrades: 240 },
  { month: 'May', downloads: 920, upgrades: 330 },
  { month: 'June', downloads: 1080, upgrades: 410 },
]

const chartConfig = {
  downloads: {
    label: 'Downloads',
    color: 'var(--chart-1)',
  },
  upgrades: {
    label: 'Upgrades',
    color: 'var(--chart-4)',
  },
} satisfies ChartConfig

const shortMonth = (month: string) => month.slice(0, 3)

export default function ChartAreaExample() {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Plugin installs</CardTitle>
        <CardDescription>Fresh downloads and upgrades, stacked</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          className="aspect-4/3 sm:aspect-video"
          config={chartConfig}
        >
          <AreaChart
            accessibilityLayer
            data={chartData}
            desc="Plugin downloads and upgrades per month, January to June"
            margin={{ left: 12, right: 12 }}
            title="Plugin installs"
          >
            <defs>
              <linearGradient id="fill-downloads" x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-downloads)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-downloads)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fill-upgrades" x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-upgrades)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-upgrades)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="month"
              tickFormatter={shortMonth}
              tickLine={false}
              tickMargin={8}
            />
            <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              dataKey="upgrades"
              fill="url(#fill-upgrades)"
              stackId="installs"
              stroke="var(--color-upgrades)"
              type="natural"
            />
            <Area
              dataKey="downloads"
              fill="url(#fill-downloads)"
              stackId="installs"
              stroke="var(--color-downloads)"
              type="natural"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
