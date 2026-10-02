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
  ChartTooltip,
  ChartTooltipContent,
} from '@vitnode/core/components/ui/chart'
import { CartesianGrid, Line, LineChart, XAxis } from 'recharts'

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

export default function ChartLineExample() {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>API response time</CardTitle>
        <CardDescription>Median in milliseconds, last week</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          className="aspect-4/3 sm:aspect-video"
          config={chartConfig}
        >
          <LineChart
            accessibilityLayer
            data={chartData}
            desc="Median API response time in milliseconds per day, Monday to Sunday"
            margin={{ left: 20, right: 20, top: 12 }}
            title="API response time"
          >
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="day"
              tickFormatter={shortDay}
              tickLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              content={<ChartTooltipContent indicator="line" />}
              cursor={false}
            />
            <Line
              activeDot={{ r: 6 }}
              dataKey="responseTime"
              dot={{ fill: 'var(--color-responseTime)' }}
              stroke="var(--color-responseTime)"
              strokeWidth={2}
              type="monotone"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
