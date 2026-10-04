const KEY_STEP = 5;
const SHIFT_KEY_STEP = 10;

export const clampPosition = (value: number) =>
  Math.min(100, Math.max(0, value));

export const positionFromPointer = (
  clientX: number,
  rect: { left: number; width: number },
) =>
  rect.width ? clampPosition(((clientX - rect.left) / rect.width) * 100) : 50;

export const positionFromKey = (
  key: string,
  current: number,
  shiftKey: boolean,
): null | number => {
  const step = shiftKey ? SHIFT_KEY_STEP : KEY_STEP;

  switch (key) {
    case "ArrowDown":
    case "ArrowLeft":
      return clampPosition(current - step);
    case "ArrowRight":
    case "ArrowUp":
      return clampPosition(current + step);
    case "End":
      return 100;
    case "Home":
      return 0;
    default:
      return null;
  }
};
