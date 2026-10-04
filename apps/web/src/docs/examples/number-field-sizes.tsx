import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@vitnode/core/components/ui/number-field'

const sizes = ['sm', 'default', 'lg'] as const

export default function NumberFieldSizesExample() {
  return (
    <div className="not-prose flex w-48 flex-col gap-3">
      {sizes.map((size) => (
        <NumberField defaultValue={4} key={size} min={0} size={size}>
          <NumberFieldGroup>
            <NumberFieldDecrement />
            <NumberFieldInput aria-label={`Quantity (${size})`} />
            <NumberFieldIncrement />
          </NumberFieldGroup>
        </NumberField>
      ))}
    </div>
  )
}
