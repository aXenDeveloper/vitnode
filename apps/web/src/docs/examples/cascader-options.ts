import type { CascaderOption } from '@vitnode/core/components/ui/cascader'

export const locations: CascaderOption[] = [
  {
    label: 'Europe',
    value: 'europe',
    children: [
      {
        label: 'Poland',
        value: 'poland',
        children: [
          { label: 'Warsaw', value: 'warsaw' },
          { label: 'Kraków', value: 'krakow' },
          { label: 'Gdańsk', value: 'gdansk' },
        ],
      },
      {
        label: 'Portugal',
        value: 'portugal',
        children: [
          { label: 'Lisbon', value: 'lisbon' },
          { label: 'Porto', value: 'porto' },
        ],
      },
      { label: 'Iceland', value: 'iceland', disabled: true },
    ],
  },
  {
    label: 'Americas',
    value: 'americas',
    children: [
      {
        label: 'Canada',
        value: 'canada',
        children: [
          { label: 'Vancouver', value: 'vancouver' },
          { label: 'Montréal', value: 'montreal' },
        ],
      },
      {
        label: 'Brazil',
        value: 'brazil',
        children: [{ label: 'São Paulo', value: 'sao-paulo' }],
      },
    ],
  },
  {
    label: 'Asia & Pacific',
    value: 'apac',
    children: [
      {
        label: 'Japan',
        value: 'japan',
        children: [
          { label: 'Tokyo', value: 'tokyo' },
          { label: 'Osaka', value: 'osaka' },
        ],
      },
      { label: 'Singapore', value: 'singapore' },
    ],
  },
]
