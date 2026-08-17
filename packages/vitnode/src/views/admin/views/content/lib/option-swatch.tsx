import type { ContentOption } from "./field-component";

export const ContentOptionSwatch = ({ option }: { option: ContentOption }) => (
  <span className="flex min-w-0 items-center gap-2">
    {!!option.color && (
      <span
        aria-hidden
        className="border-border/50 size-3 shrink-0 rounded-[4px] border"
        style={{ backgroundColor: option.color }}
      />
    )}
    <span className="truncate">{option.label}</span>
  </span>
);
