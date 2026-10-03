import { cn } from "cn";
import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from "embla-carousel-react";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
} from "lucide-react";
import { useReducedMotion } from "motion/react";
import React from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";

import {
  carouselStepFromKey,
  isEditableTarget,
  isRtlElement,
} from "./carousel-utils";

type CarouselApi = UseEmblaCarouselType[1];
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugin = UseCarouselParameters[1];

interface CarouselProps {
  opts?: CarouselOptions;
  orientation?: "horizontal" | "vertical";
  plugins?: CarouselPlugin;
  setApi?: (api: CarouselApi) => void;
}

type CarouselContextProps = CarouselProps & {
  api: ReturnType<typeof useEmblaCarousel>[1];
  canScrollNext: boolean;
  canScrollPrev: boolean;
  carouselRef: ReturnType<typeof useEmblaCarousel>[0];
  scrollNext: () => void;
  scrollPrev: () => void;
};

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

function useCarousel() {
  const context = React.use(CarouselContext);

  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />");
  }

  return context;
}

function Carousel({
  orientation = "horizontal",
  opts,
  setApi,
  plugins,
  className,
  children,
  ...props
}: CarouselProps & React.ComponentProps<"div">) {
  const shouldReduceMotion = useReducedMotion();
  const [carouselRef, api] = useEmblaCarousel(
    {
      duration: 20,
      ...opts,
      ...(shouldReduceMotion && { duration: 0 }),
      axis: orientation === "horizontal" ? "x" : "y",
    },
    plugins,
  );
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);

  const onSelect = React.useCallback((api: CarouselApi) => {
    if (!api) return;
    // eslint-disable-next-line @eslint-react/set-state-in-effect
    setCanScrollPrev(api.canScrollPrev());
    // eslint-disable-next-line @eslint-react/set-state-in-effect
    setCanScrollNext(api.canScrollNext());
  }, []);

  const scrollPrev = React.useCallback(() => {
    api?.scrollPrev();
  }, [api]);

  const scrollNext = React.useCallback(() => {
    api?.scrollNext();
  }, [api]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || isEditableTarget(event.target)) return;

    const step = carouselStepFromKey({
      isRtl: opts?.direction
        ? opts.direction === "rtl"
        : isRtlElement(event.currentTarget),
      key: event.key,
      orientation,
    });
    if (step === null) return;

    event.preventDefault();
    if (step === 1) {
      scrollNext();
    } else {
      scrollPrev();
    }
  };

  React.useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler
    if (!api || !setApi) return;
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-pass-data-to-parent
    setApi(api);
  }, [api, setApi]);

  React.useEffect(() => {
    if (!api) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    onSelect(api);
    api.on("reInit", onSelect);
    api.on("select", onSelect);

    return () => {
      api.off("reInit", onSelect);
      api.off("select", onSelect);
    };
  }, [api, onSelect]);

  return (
    <CarouselContext.Provider
      value={{
        carouselRef,
        api: api,
        opts,
        orientation:
          orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
        scrollPrev,
        scrollNext,
        canScrollPrev,
        canScrollNext,
      }}
    >
      <div
        aria-roledescription="carousel"
        className={cn("relative", className)}
        data-slot="carousel"
        onKeyDown={handleKeyDown}
        role="region"
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  );
}

function CarouselContent({ className, ...props }: React.ComponentProps<"div">) {
  const { carouselRef, orientation } = useCarousel();

  return (
    <div
      className="overflow-hidden"
      data-slot="carousel-content"
      ref={carouselRef}
    >
      <div
        className={cn(
          "flex",
          orientation === "horizontal" ? "-ms-4" : "-mt-4 flex-col",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function CarouselItem({ className, ...props }: React.ComponentProps<"div">) {
  const { orientation } = useCarousel();

  return (
    <div
      aria-roledescription="slide"
      className={cn(
        "min-w-0 shrink-0 grow-0 basis-full",
        orientation === "horizontal" ? "ps-4" : "pt-4",
        className,
      )}
      data-slot="carousel-item"
      role="group"
      {...props}
    />
  );
}

function CarouselPrevious({
  className,
  variant = "outline",
  size = "icon-sm",
  ...props
}: React.ComponentProps<typeof Button>) {
  const { orientation, scrollPrev, canScrollPrev } = useCarousel();
  const t = useTranslations("core.global");

  return (
    <Button
      aria-label={t("previous")}
      className={cn(
        "absolute touch-manipulation rounded-full",
        orientation === "horizontal"
          ? "inset-y-0 -inset-s-12 my-auto"
          : "inset-x-0 -top-12 mx-auto",
        className,
      )}
      data-slot="carousel-previous"
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      size={size}
      variant={variant}
      {...props}
    >
      {orientation === "horizontal" ? (
        <ChevronLeftIcon className="rtl:rotate-180" />
      ) : (
        <ChevronUpIcon />
      )}
    </Button>
  );
}

function CarouselNext({
  className,
  variant = "outline",
  size = "icon-sm",
  ...props
}: React.ComponentProps<typeof Button>) {
  const { orientation, scrollNext, canScrollNext } = useCarousel();
  const t = useTranslations("core.global");

  return (
    <Button
      aria-label={t("next")}
      className={cn(
        "absolute touch-manipulation rounded-full",
        orientation === "horizontal"
          ? "inset-y-0 -inset-e-12 my-auto"
          : "inset-x-0 -bottom-12 mx-auto",
        className,
      )}
      data-slot="carousel-next"
      disabled={!canScrollNext}
      onClick={scrollNext}
      size={size}
      variant={variant}
      {...props}
    >
      {orientation === "horizontal" ? (
        <ChevronRightIcon className="rtl:rotate-180" />
      ) : (
        <ChevronDownIcon />
      )}
    </Button>
  );
}

export {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  useCarousel,
};
