import { ImageIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { FileConstraints } from "@/lib/file-constraints";

import {
  FileConstraintsLine,
  FileDropzone,
  FileError,
} from "@/components/form/fields/file-shared";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

import type { Offset, Size } from "./crop-math";
import type { LoadedSource } from "./crop-render";
import type { ImageCrop } from "./use-image-crop";

import {
  clampOffset,
  clampZoom,
  displayedSize,
  MAX_ZOOM,
  MIN_ZOOM,
  rescaleOffset,
} from "./crop-math";

const KEYBOARD_STEP = 10;
const ZOOM_STEP = 0.1;
const WHEEL_ZOOM_STEP = 0.0015;
const STAGE_MAX_HEIGHT = 260;

export type ImageCropShape = "circle" | "rect";

const useFrameSize = (
  ref: React.RefObject<HTMLDivElement | null>,
  onResize: (from: Size, to: Size) => void,
): Size => {
  const [size, setSize] = React.useState<Size>({ height: 0, width: 0 });
  const previousRef = React.useRef(size);
  const handleResize = React.useEffectEvent(onResize);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;

      const next = {
        height: entry.contentRect.height,
        width: entry.contentRect.width,
      };
      handleResize(previousRef.current, next);
      previousRef.current = next;
      setSize(next);
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return size;
};

const imageTransform = (offset: Offset) =>
  `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`;

const CIRCLE_MASK_PATH =
  "M0 0h100v100H0Z M50 0a50 50 0 1 0 0 100 50 50 0 1 0 0-100Z";

const CircleCropMask = () => (
  <svg
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 size-full"
    preserveAspectRatio="none"
    viewBox="0 0 100 100"
  >
    <path className="fill-black/45" d={CIRCLE_MASK_PATH} fillRule="evenodd" />
  </svg>
);

const CropStage = ({
  aspect,
  offset,
  onOffsetChange,
  onZoomChange,
  shape,
  source,
  zoom,
}: {
  aspect: number;
  offset: Offset;
  onOffsetChange: ImageCrop["updateOffset"];
  onZoomChange: ImageCrop["updateZoom"];
  shape: ImageCropShape;
  source: LoadedSource;
  zoom: number;
}) => {
  const t = useTranslations("core.global.image_crop");
  const frameRef = React.useRef<HTMLDivElement>(null);
  const imageRef = React.useRef<HTMLImageElement>(null);
  // A drag moves the image straight through the DOM and commits the offset
  // once on release, so the dialog does not re-render on every pointer move.
  const dragRef = React.useRef<null | {
    latest: Offset;
    origin: Offset;
    start: Offset;
  }>(null);

  const frame = useFrameSize(frameRef, (from, to) => {
    onOffsetChange(current => rescaleOffset(current, from, to), to);
  });

  React.useEffect(() => {
    const element = frameRef.current;
    if (!element) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      onZoomChange(current =>
        clampZoom(current - event.deltaY * WHEEL_ZOOM_STEP),
      );
    };
    element.addEventListener("wheel", onWheel, { passive: false });

    return () => element.removeEventListener("wheel", onWheel);
  }, [onZoomChange]);

  const shown = displayedSize(source.size, frame, zoom);

  const nudge = (dx: number, dy: number) => {
    onOffsetChange(current => ({ x: current.x + dx, y: current.y + dy }));
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = dragRef.current;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (active) onOffsetChange(() => active.latest);
  };

  return (
    <div
      aria-label={t("stage_label")}
      aria-roledescription={t("stage_instructions")}
      className="bg-muted focus-visible:ring-ring/50 relative mx-auto w-full cursor-move touch-none overflow-hidden rounded-xl select-none focus-visible:ring-4 focus-visible:outline-hidden"
      onKeyDown={event => {
        switch (event.key) {
          case "+":
          case "=":
            event.preventDefault();
            onZoomChange(current => clampZoom(current + ZOOM_STEP));
            break;
          case "-":
          case "_":
            event.preventDefault();
            onZoomChange(current => clampZoom(current - ZOOM_STEP));
            break;
          case "ArrowDown":
            event.preventDefault();
            nudge(0, -KEYBOARD_STEP);
            break;
          case "ArrowLeft":
            event.preventDefault();
            nudge(KEYBOARD_STEP, 0);
            break;
          case "ArrowRight":
            event.preventDefault();
            nudge(-KEYBOARD_STEP, 0);
            break;
          case "ArrowUp":
            event.preventDefault();
            nudge(0, KEYBOARD_STEP);
            break;
        }
      }}
      onPointerCancel={endDrag}
      onPointerDown={event => {
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
          latest: offset,
          origin: offset,
          start: { x: event.clientX, y: event.clientY },
        };
      }}
      onPointerMove={event => {
        const active = dragRef.current;
        if (!active) return;

        active.latest = clampOffset(
          {
            x: active.origin.x + event.clientX - active.start.x,
            y: active.origin.y + event.clientY - active.start.y,
          },
          source.size,
          frame,
          zoom,
        );
        if (imageRef.current) {
          imageRef.current.style.transform = imageTransform(active.latest);
        }
      }}
      onPointerUp={endDrag}
      ref={frameRef}
      role="application"
      style={{
        aspectRatio: String(aspect),
        maxWidth: STAGE_MAX_HEIGHT * aspect,
      }}
      tabIndex={0}
    >
      <img
        alt=""
        className="pointer-events-none absolute top-1/2 left-1/2 max-w-none"
        draggable={false}
        ref={imageRef}
        src={source.url}
        style={{
          height: shown.height,
          transform: imageTransform(offset),
          width: shown.width,
        }}
      />
      {shape === "circle" ? <CircleCropMask /> : null}
    </div>
  );
};

export interface ImageCropFieldsProps {
  aspect: number;
  constraints: FileConstraints;
  crop: ImageCrop;
  disabled?: boolean;
  shape: ImageCropShape;
}

export const ImageCropFields = ({
  aspect,
  constraints,
  crop,
  disabled = false,
  shape,
}: ImageCropFieldsProps) => {
  const t = useTranslations("core.global.image_crop");

  if (!crop.source) {
    return (
      <div className="flex flex-col gap-3">
        <FileDropzone
          accept={crop.accept}
          disabled={disabled}
          disabledLabel={t("drop")}
          onPick={crop.pick}
          pending={crop.isLoading}
          promptLabel={t("drop")}
          state={crop.error ? "error" : "idle"}
        />
        <FileConstraintsLine {...constraints} />
        {crop.error ? <FileError>{crop.error}</FileError> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <CropStage
        aspect={aspect}
        offset={crop.offset}
        onOffsetChange={crop.updateOffset}
        onZoomChange={crop.updateZoom}
        shape={shape}
        source={crop.source}
        zoom={crop.zoom}
      />

      <div className="flex items-center gap-3">
        <ZoomOutIcon
          aria-hidden="true"
          className="text-muted-foreground size-4 shrink-0"
        />
        <Slider
          aria-label={t("zoom")}
          max={MAX_ZOOM}
          min={MIN_ZOOM}
          onValueChange={value => {
            const next = Array.isArray(value) ? value[0] : value;
            if (typeof next === "number") crop.updateZoom(() => next);
          }}
          step={0.01}
          value={crop.zoom}
        />
        <ZoomInIcon
          aria-hidden="true"
          className="text-muted-foreground size-4 shrink-0"
        />
      </div>

      <p className="text-muted-foreground text-sm leading-relaxed">
        {t("stage_instructions")}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FileConstraintsLine {...constraints} />
        <Button
          disabled={disabled}
          onClick={crop.clear}
          size="sm"
          type="button"
          variant="outline"
        >
          <ImageIcon />
          {t("change")}
        </Button>
      </div>

      {crop.error ? <FileError>{crop.error}</FileError> : null}
    </div>
  );
};
