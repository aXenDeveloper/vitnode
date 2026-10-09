import { Pet } from '@vitnode/core/components/pet/pet'

export default function PetExample() {
  return (
    <Pet
      className="h-64 w-56"
      label="Tabby, the VitNode pet, waving hello"
      state="hello"
    />
  )
}
