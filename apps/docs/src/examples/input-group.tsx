import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@vitnode/core/components/ui/input-group";
import { Search } from "lucide-react";

export default function InputGroupDemo() {
  return (
    <div className="flex flex-col gap-8">
      <InputGroup>
        <InputGroupInput placeholder="Search..." />
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupAddon align="inline-end">12 results</InputGroupAddon>
      </InputGroup>

      <InputGroup>
        <InputGroupTextarea
          className="min-h-24 resize-none"
          placeholder="I'm having an issue with the login button on mobile."
          rows={6}
        />
        <InputGroupAddon align="block-end">
          <InputGroupText className="tabular-nums">
            0 of 500 characters
          </InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
