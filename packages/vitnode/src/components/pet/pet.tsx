import { cn } from "cn";

import { PET_STATES, type PetState } from "./states";
import { PET_CSS } from "./styles";

export type { PetState } from "./states";

export const PET_STATE_NAMES = Object.keys(PET_STATES) as PetState[];

/**
 * VitNode's animated mascot as an inline SVG. Its CSS is injected once per
 * page. Decorative (hidden from screen readers) unless you pass `label`.
 */
export const Pet = ({
  className,
  label,
  state = "idle",
}: {
  className?: string;
  /** Accessible name; without it the SVG is `aria-hidden`. */
  label?: string;
  /** Which animation to play, one of {@link PET_STATE_NAMES}. Defaults to `idle`. */
  state?: PetState;
}) => {
  const State = PET_STATES[state];

  return (
    <>
      <style href="vitnode-pet" precedence="vitnode-pet">
        {PET_CSS}
      </style>
      <svg
        aria-hidden={label ? undefined : true}
        aria-label={label}
        className={cn("vitnode-pet overflow-visible", className)}
        data-pet-state={state}
        fill="none"
        role={label ? "img" : undefined}
        viewBox="0 0 400 460"
        xmlns="http://www.w3.org/2000/svg"
      >
        <State />
      </svg>
    </>
  );
};
