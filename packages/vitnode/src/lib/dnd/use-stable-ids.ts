import { useState } from "react";

const sameIds = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length &&
  left.every((id, index) => id === right[index]);

export const useStableIds = <T extends string>(ids: T[]): T[] => {
  const [stable, setStable] = useState(ids);

  if (!sameIds(stable, ids)) {
    setStable(ids);

    return ids;
  }

  return stable;
};
