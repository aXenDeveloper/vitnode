import type { ReactElement, ReactNode } from "react";

import { useId } from "react";

import { Label } from "../../components/ui/label";

export interface LabelledControlIds {
  "aria-describedby": string | undefined;
  "aria-labelledby": string;
}

export const LabelledControl = ({
  children,
  description,
  label,
  value,
}: {
  children: (ids: LabelledControlIds) => ReactNode;
  description?: string;
  label: string;
  value?: ReactNode;
}): ReactElement => {
  const labelId = useId();
  const descriptionId = useId();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label id={labelId}>{label}</Label>

        {value === undefined ? null : (
          <span className="text-muted-foreground text-xs leading-relaxed tabular-nums">
            {value}
          </span>
        )}
      </div>

      {children({
        "aria-describedby":
          description === undefined ? undefined : descriptionId,
        "aria-labelledby": labelId,
      })}

      {description === undefined ? null : (
        <p
          className="text-muted-foreground text-xs leading-relaxed text-pretty"
          id={descriptionId}
        >
          {description}
        </p>
      )}
    </div>
  );
};
