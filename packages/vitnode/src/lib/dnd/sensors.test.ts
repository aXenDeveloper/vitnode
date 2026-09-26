import type { PointerEvent } from "react";

import { describe, expect, it, vi } from "vitest";

import { FinePointerSensor } from "./sensors";

const press = (pointerType: string, button = 0) => {
  const onActivation = vi.fn();
  const [activator] = FinePointerSensor.activators;
  const started = activator.handler(
    {
      nativeEvent: { button, isPrimary: true, pointerType },
    } as unknown as PointerEvent,
    { onActivation },
  );

  return { onActivation, started };
};

describe("the pointer sensor behind whole-widget dragging", () => {
  it("starts a drag from a mouse or a pen", () => {
    expect(press("mouse").started).toBe(true);
    expect(press("pen").onActivation).toHaveBeenCalledOnce();
  });

  it("leaves a finger to the long-press sensor, so a swipe still scrolls", () => {
    const { onActivation, started } = press("touch");

    expect(started).toBe(false);
    expect(onActivation).not.toHaveBeenCalled();
  });

  it("ignores anything but the main button", () => {
    expect(press("mouse", 2).started).toBe(false);
  });
});
