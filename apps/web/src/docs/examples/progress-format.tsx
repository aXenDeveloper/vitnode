import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from '@vitnode/core/components/ui/progress'

export default function ProgressFormatExample() {
  return (
    <div className="not-prose flex w-full max-w-sm flex-col gap-6">
      <Progress max={10} value={7}>
        <ProgressLabel>Onboarding steps</ProgressLabel>
        <ProgressValue>{(_, value) => `${value} of 10`}</ProgressValue>
      </Progress>
      <Progress
        format={{ style: 'unit', unit: 'gigabyte' }}
        getAriaValueText={(formatted) => `${formatted} of 10 GB used`}
        max={10}
        value={9.2}
      >
        <ProgressLabel>Storage</ProgressLabel>
        <ProgressValue />
      </Progress>
    </div>
  )
}
