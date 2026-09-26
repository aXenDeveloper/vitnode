import type { PointerSensorOptions } from "@dnd-kit/core";
import type { PointerEvent } from "react";

import { PointerSensor } from "@dnd-kit/core";

export class FinePointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: (
        { nativeEvent: event }: PointerEvent,
        { onActivation }: PointerSensorOptions,
      ): boolean => {
        if (
          !event.isPrimary ||
          event.button !== 0 ||
          event.pointerType === "touch"
        ) {
          return false;
        }

        onActivation?.({ event });

        return true;
      },
    },
  ];
}
