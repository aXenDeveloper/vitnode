export const INCOMING_ID = "vitnode-dashboard-incoming";

export const nextIncomingIndex = ({
  current,
  endId,
  itemIds,
  overId,
}: {
  current: null | number;
  endId: string;
  itemIds: readonly string[];
  overId: null | string;
}): null | number => {
  if (overId === null) return null;
  if (overId === INCOMING_ID) return current;
  if (overId === endId) return itemIds.length;

  const index = itemIds.indexOf(overId);

  return index === -1 ? current : index;
};

interface Point {
  x: number;
  y: number;
}

interface Box {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export const pointsAtBoard = ({
  pointer,
  targets,
}: {
  pointer: Point;
  targets: readonly Box[];
}): boolean =>
  targets.length > 0 &&
  pointer.x >= Math.min(...targets.map(target => target.left)) &&
  pointer.x <= Math.max(...targets.map(target => target.right)) &&
  pointer.y >= Math.min(...targets.map(target => target.top)) &&
  pointer.y <= Math.max(...targets.map(target => target.bottom));
