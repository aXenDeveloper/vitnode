import React from "react";

import { splitSearchHighlight } from "./search-highlight";

export const SearchHighlightText = ({
  pattern,
  text,
}: {
  pattern: null | RegExp;
  text: string;
}) => {
  if (!pattern) return text;

  return splitSearchHighlight(text, pattern).map(part =>
    part.match ? (
      <mark
        className="bg-warn/25 text-foreground rounded-sm box-decoration-clone"
        key={part.start}
      >
        {part.text}
      </mark>
    ) : (
      <React.Fragment key={part.start}>{part.text}</React.Fragment>
    ),
  );
};
