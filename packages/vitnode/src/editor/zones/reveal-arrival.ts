import { revealWhenRendered } from "../../lib/dnd/reveal";

export const revealArrivedNode = (nodeId: string): void => {
  const escaped = CSS.escape(nodeId);

  revealWhenRendered(
    `[data-block-id="${escaped}"], [data-area-id="${escaped}"]`,
  );
};
