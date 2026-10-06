import type { ChartConfig } from '@vitnode/core/components/ui/chart'

import { areaY, defineChart, lineY } from '@tanstack/charts'
import { d3Curve } from '@tanstack/charts/d3/shape'
import { decorative } from '@tanstack/charts/mark/decorative'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scalePoint } from '@tanstack/charts/scales/point'
import { tooltip } from '@tanstack/charts/tooltip'
import { fold } from '@tanstack/charts/transform/fold'
import { stackRowsY } from '@tanstack/charts/transform/stack'
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
import { curveMonotoneX } from 'd3-shape'

import { EntranceChart } from '../entrance-chart'

const chartData = [
  { month: 'January', downloads: 420, upgrades: 120 },
  { month: 'February', downloads: 610, upgrades: 180 },
  { month: 'March', downloads: 530, upgrades: 260 },
  { month: 'April', downloads: 780, upgrades: 240 },
  { month: 'May', downloads: 920, upgrades: 330 },
  { month: 'June', downloads: 1080, upgrades: 410 },
]

const chartConfig = {
  upgrades: {
    label: 'Upgrades',
    color: 'var(--chart-4)',
  },
  downloads: {
    label: 'Downloads',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

const shortMonth = (month: string) => month.slice(0, 3)

const curve = d3Curve(curveMonotoneX)

const rows = stackRowsY(
  fold(chartData, {
    fields: ['upgrades', 'downloads'] as const,
    as: { key: 'kind', value: 'installs' },
  }),
  { x: 'month', y: 'installs', z: 'kind' },
)

const definition = defineChart({
  marks: [
    decorative(
      areaY(rows, {
        x: 'month',
        y1: 'y1',
        y2: 'y2',
        z: 'kind',
        fill: (row) => `url(#fill-${row.kind})`,
        fillOpacity: 1,
        curve,
      }),
    ),
    lineY(rows, { x: 'month', y: 'y2', z: 'kind', strokeWidth: 2, curve }),
  ],
  scales: {
    x: {
      scale: () => scalePoint().padding(0.1),
      axis: { line: false, ticks: { size: 0, format: shortMonth } },
    },
    y: { scale: scaleLinear, nice: true, grid: true, axis: false },
  },
  color: chartColor(chartConfig),
  gradients: (['downloads', 'upgrades'] as const).map((kind) => ({
    id: `fill-${kind}`,
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 1,
    stops: [
      { offset: 0.05, color: `var(--color-${kind})`, opacity: 0.8 },
      { offset: 0.95, color: `var(--color-${kind})`, opacity: 0.1 },
    ],
  })),
  focus: 'group-x',
  maxFocusDistance: Number.POSITIVE_INFINITY,
  tooltip: { use: tooltip, motion: chartTooltipMotion },
})

export default function ChartAreaExample() {
  return (
    <Card className="not-prose w-full">
      <CardHeader>
        <CardTitle>Plugin installs</CardTitle>
        <CardDescription>Fresh downloads and upgrades, stacked</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <EntranceChart
            ariaDescription="Plugin downloads and upgrades per month, January to June"
            ariaLabel="Plugin installs"
            definition={definition}
            height={280}
            renderTooltipBody={({ points }) => (
              <ChartTooltipContent points={points} valueKey="installs" />
            )}
          />
          <ChartLegend />
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
