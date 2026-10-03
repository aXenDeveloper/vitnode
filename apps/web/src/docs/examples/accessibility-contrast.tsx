import { Badge } from '@vitnode/core/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@vitnode/core/components/ui/select'
import { CheckIcon, XIcon } from 'lucide-react'
import React from 'react'

import { useCssVariables } from '../use-css-variables'

const TEXT_TOKENS = [
  'foreground',
  'muted-foreground',
  'primary',
  'primary-foreground',
  'success',
  'warn',
  'destructive',
] as const

const SURFACE_TOKENS = [
  'background',
  'card',
  'muted',
  'primary',
  'secondary',
] as const

const ALL_TOKENS = [...new Set([...SURFACE_TOKENS, ...TEXT_TOKENS])]

const LEVELS = [
  { label: 'AA', min: 4.5 },
  { label: 'AA Large', min: 3 },
  { label: 'AAA', min: 7 },
] as const

const clampUnit = (value: number) => Math.min(1, Math.max(0, value))

const parseOklch = (value: string) => {
  const match = /oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/.exec(value)
  if (!match) return null
  const lightness = Number(match[1]) / (match[2] === '%' ? 100 : 1)

  return { c: Number(match[3]), h: Number(match[4]), l: lightness }
}

const relativeLuminance = (value: string) => {
  const color = parseOklch(value)
  if (!color) return null

  const hue = (color.h * Math.PI) / 180
  const a = color.c * Math.cos(hue)
  const b = color.c * Math.sin(hue)

  const l = (color.l + 0.396_337_777_4 * a + 0.215_803_757_3 * b) ** 3
  const m = (color.l - 0.105_561_345_8 * a - 0.063_854_172_8 * b) ** 3
  const s = (color.l - 0.089_484_177_5 * a - 1.291_485_548 * b) ** 3

  const red = clampUnit(
    4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s,
  )
  const green = clampUnit(
    -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s,
  )
  const blue = clampUnit(
    -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s,
  )

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

const contrastRatio = (text: string, surface: string) => {
  const textLuminance = relativeLuminance(text)
  const surfaceLuminance = relativeLuminance(surface)
  if (textLuminance === null || surfaceLuminance === null) return null
  const lighter = Math.max(textLuminance, surfaceLuminance)
  const darker = Math.min(textLuminance, surfaceLuminance)

  return (lighter + 0.05) / (darker + 0.05)
}

const TokenSelect = ({
  label,
  onChange,
  tokens,
  value,
}: {
  label: string
  onChange: (value: string) => void
  tokens: readonly string[]
  value: string
}) => {
  const labelId = React.useId()

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <span className="text-sm font-medium" id={labelId}>
        {label}
      </span>
      <Select
        onValueChange={(next) => {
          if (typeof next === 'string') onChange(next)
        }}
        value={value}
      >
        <SelectTrigger aria-labelledby={labelId} className="w-full font-mono">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {tokens.map((token) => (
            <SelectItem className="font-mono" key={token} value={token}>
              {token}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default function AccessibilityContrast() {
  const [text, setText] = React.useState('muted-foreground')
  const [surface, setSurface] = React.useState('card')
  const values = useCssVariables(ALL_TOKENS)
  const textValue = values[text]
  const surfaceValue = values[surface]
  const ratio =
    textValue && surfaceValue ? contrastRatio(textValue, surfaceValue) : null

  return (
    <div className="not-prose flex w-full flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <TokenSelect
          label="Text"
          onChange={setText}
          tokens={TEXT_TOKENS}
          value={text}
        />
        <TokenSelect
          label="Surface"
          onChange={setSurface}
          tokens={SURFACE_TOKENS}
          value={surface}
        />
      </div>

      <div
        className="flex flex-col gap-1 rounded-lg border p-4"
        style={{
          backgroundColor: `var(--${surface})`,
          color: `var(--${text})`,
        }}
      >
        <span className="text-lg font-semibold">3 new replies</span>
        <span className="text-sm leading-relaxed">
          Someone answered your question about dark mode.
        </span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums">
            {ratio === null ? '…' : ratio.toFixed(2)}
          </span>
          <span className="text-muted-foreground text-sm">: 1 contrast</span>
        </p>
        <ul className="flex flex-wrap gap-2">
          {LEVELS.map((level) => {
            const isPassing = ratio !== null && ratio >= level.min

            return (
              <li key={level.label}>
                <Badge variant={isPassing ? 'success' : 'destructive'}>
                  {isPassing ? <CheckIcon /> : <XIcon />}
                  {level.label}
                  <span className="sr-only">
                    {isPassing ? ' passes' : ' fails'}
                  </span>
                </Badge>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
