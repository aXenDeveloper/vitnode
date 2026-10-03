interface Rect {
  height: number;
  left: number;
  top: number;
  width: number;
}

export const fitZoomedRect = (
  aspectRatio: number,
  viewport: { height: number; padding: number; width: number },
): Rect => {
  const maxWidth = viewport.width - viewport.padding * 2;
  const maxHeight = viewport.height - viewport.padding * 2;
  const width = Math.min(maxWidth, maxHeight * aspectRatio);
  const height = width / aspectRatio;

  return {
    height,
    left: (viewport.width - width) / 2,
    top: (viewport.height - height) / 2,
    width,
  };
};

export const zoomOrigin = (from: Rect, to: Rect) => ({
  scale: from.width / to.width,
  x: from.left - to.left,
  y: from.top - to.top,
});

const DECELERATION_RATE = 0.998;
const DISMISS_DISTANCE = 160;
const FADE_DISTANCE = DISMISS_DISTANCE * 3;
const MIN_DRAG_OPACITY = 0.2;

interface Point {
  x: number;
  y: number;
}

export const projectDragOffset = (offset: number, velocity: number) =>
  offset + ((velocity / 1000) * DECELERATION_RATE) / (1 - DECELERATION_RATE);

export const shouldDismissZoom = ({
  offset,
  velocity,
}: {
  offset: Point;
  velocity: Point;
}) =>
  Math.hypot(
    projectDragOffset(offset.x, velocity.x),
    projectDragOffset(offset.y, velocity.y),
  ) > DISMISS_DISTANCE;

export const dragBackdropOpacity = (offset: Point) =>
  Math.max(
    MIN_DRAG_OPACITY,
    1 - Math.hypot(offset.x, offset.y) / FADE_DISTANCE,
  );
