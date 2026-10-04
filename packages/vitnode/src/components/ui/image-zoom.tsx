import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";
import { XIcon } from "lucide-react";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import React from "react";
import { useTranslations } from "use-intl";

import { MotionFeatures } from "@/components/motion-features";

import {
  dragBackdropOpacity,
  fitZoomedRect,
  shouldDismissZoom,
  zoomOrigin,
} from "./image-zoom-utils";

const ZOOM_TRANSITION = { type: "spring", duration: 0.4, bounce: 0 } as const;
const ZOOMED = { scale: 1, x: 0, y: 0 };

const measureZoom = (image: HTMLImageElement) => {
  const thumb = image.getBoundingClientRect();
  const padding = window.matchMedia("(min-width: 48rem)").matches ? 40 : 16;
  const target = fitZoomedRect(thumb.width / thumb.height, {
    height: window.innerHeight,
    padding,
    width: window.innerWidth,
  });

  return { origin: zoomOrigin(thumb, target), target };
};

function ImageZoom({
  alt,
  className,
  imageClassName,
  src,
  zoomSrc,
}: {
  alt: string;
  className?: string;
  imageClassName?: string;
  src: string;
  zoomSrc?: string;
}) {
  const t = useTranslations("core.global");
  const shouldReduceMotion = useReducedMotion();
  const thumbRef = React.useRef<HTMLImageElement>(null);
  const backdropRef = React.useRef<HTMLDivElement>(null);
  const wasDraggedRef = React.useRef(false);
  const [zoom, setZoom] = React.useState<null | ReturnType<typeof measureZoom>>(
    null,
  );
  const [isClosing, setIsClosing] = React.useState(false);

  const open = () => {
    if (!thumbRef.current) return;

    setIsClosing(false);
    setZoom(measureZoom(thumbRef.current));
  };

  const close = () => {
    if (shouldReduceMotion || !thumbRef.current || !zoom) {
      setZoom(null);

      return;
    }

    setZoom({ ...zoom, origin: measureZoom(thumbRef.current).origin });
    setIsClosing(true);
  };

  const setBackdropDragStyle = (opacity: string, transition: string) => {
    if (!backdropRef.current) return;

    backdropRef.current.style.opacity = opacity;
    backdropRef.current.style.transition = transition;
  };

  return (
    <MotionFeatures withLayoutAndDrag>
      <DialogPrimitive.Root
        onOpenChange={next => {
          if (next) {
            open();

            return;
          }

          close();
        }}
        open={zoom !== null}
      >
        <DialogPrimitive.Trigger
          className={cn(
            "focus-visible:ring-ring/50 relative block cursor-zoom-in rounded-md outline-none focus-visible:ring-3",
            className,
          )}
          data-slot="image-zoom"
        >
          <img
            alt={alt}
            className={cn(zoom && "invisible", imageClassName)}
            ref={thumbRef}
            src={src}
          />
        </DialogPrimitive.Trigger>

        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop
            className={cn(
              "bg-background/80 ease-fluid reduced-transparency:bg-background reduced-transparency:backdrop-blur-none fixed inset-0 z-50 backdrop-blur-md transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none",
              isClosing && "opacity-0",
            )}
            ref={backdropRef}
          />
          <DialogPrimitive.Popup
            aria-label={alt}
            className="fixed inset-0 z-50 cursor-zoom-out outline-none"
            data-slot="image-zoom-popup"
            onClick={() => {
              if (!wasDraggedRef.current) close();
            }}
            onPointerDown={() => {
              wasDraggedRef.current = false;
            }}
          >
            {zoom && (
              <m.img
                alt={alt}
                animate={isClosing ? zoom.origin : ZOOMED}
                className="absolute touch-none rounded-md object-contain shadow-xl"
                drag={!isClosing}
                draggable={false}
                dragSnapToOrigin
                initial={shouldReduceMotion ? false : zoom.origin}
                onAnimationComplete={() => {
                  if (isClosing) setZoom(null);
                }}
                onDrag={(_, info) => {
                  setBackdropDragStyle(
                    String(dragBackdropOpacity(info.offset)),
                    "none",
                  );
                }}
                onDragEnd={(_, info) => {
                  setBackdropDragStyle("", "");

                  if (shouldDismissZoom(info)) close();
                }}
                onDragStart={() => {
                  wasDraggedRef.current = true;
                }}
                src={zoomSrc ?? src}
                style={{
                  height: zoom.target.height,
                  left: zoom.target.left,
                  originX: 0,
                  originY: 0,
                  top: zoom.target.top,
                  width: zoom.target.width,
                }}
                transition={
                  shouldReduceMotion ? { duration: 0 } : ZOOM_TRANSITION
                }
              />
            )}
            <DialogPrimitive.Close
              aria-label={t("close")}
              className={cn(
                "bg-foreground text-background focus-visible:ring-ring/50 absolute end-4 top-4 flex size-10 cursor-pointer items-center justify-center rounded-full transition-opacity outline-none focus-visible:ring-3",
                isClosing && "opacity-0",
              )}
            >
              <XIcon className="size-5" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </MotionFeatures>
  );
}

export { ImageZoom };
