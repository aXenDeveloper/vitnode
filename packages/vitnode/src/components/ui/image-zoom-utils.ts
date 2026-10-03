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
