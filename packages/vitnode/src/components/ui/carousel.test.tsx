import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "./carousel";

class NoopObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}

const renderCarousel = async (
  props: Partial<React.ComponentProps<typeof Carousel>> = {},
  container?: HTMLElement,
) => {
  let api: CarouselApi;
  render(
    <Carousel
      aria-label="Gallery"
      setApi={next => {
        api = next;
      }}
      {...props}
    >
      <CarouselContent>
        <CarouselItem>
          <input aria-label="Caption" />
        </CarouselItem>
        <CarouselItem>Two</CarouselItem>
      </CarouselContent>
    </Carousel>,
    { container },
  );
  await act(async () => {
    await Promise.resolve();
  });

  if (!api) throw new Error("Carousel api was never set");

  return {
    scrollNext: vi.spyOn(api, "scrollNext").mockImplementation(() => {}),
    scrollPrev: vi.spyOn(api, "scrollPrev").mockImplementation(() => {}),
  };
};

describe("Carousel keyboard", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", NoopObserver);
    vi.stubGlobal("IntersectionObserver", NoopObserver);
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        matches: false,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("moves with the arrow keys of its own axis", async () => {
    const { scrollNext, scrollPrev } = await renderCarousel({
      orientation: "vertical",
    });
    const region = screen.getByRole("region", { name: "Gallery" });

    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(scrollNext).not.toHaveBeenCalled();

    fireEvent.keyDown(region, { key: "ArrowDown" });
    fireEvent.keyDown(region, { key: "ArrowUp" });
    expect(scrollNext).toHaveBeenCalledTimes(1);
    expect(scrollPrev).toHaveBeenCalledTimes(1);
  });

  it("leaves arrow keys to a text field inside a slide", async () => {
    const { scrollNext, scrollPrev } = await renderCarousel();

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Caption" }), {
      key: "ArrowLeft",
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Caption" }), {
      key: "ArrowRight",
    });

    expect(scrollNext).not.toHaveBeenCalled();
    expect(scrollPrev).not.toHaveBeenCalled();
  });

  it("follows reading order in a right-to-left carousel", async () => {
    const { scrollNext } = await renderCarousel({ opts: { direction: "rtl" } });

    fireEvent.keyDown(screen.getByRole("region", { name: "Gallery" }), {
      key: "ArrowLeft",
    });

    expect(scrollNext).toHaveBeenCalledTimes(1);
  });

  it("reads the page direction when the carousel has none of its own", async () => {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("dir", "rtl");
    document.body.append(wrapper);
    const { scrollPrev } = await renderCarousel({}, wrapper);

    fireEvent.keyDown(screen.getByRole("region", { name: "Gallery" }), {
      key: "ArrowRight",
    });

    expect(scrollPrev).toHaveBeenCalledTimes(1);
    wrapper.remove();
  });

  it("lets a child that handled the key keep it", async () => {
    const { scrollNext } = await renderCarousel();
    const region = screen.getByRole("region", { name: "Gallery" });
    const slide = region.querySelector('[data-slot="carousel-item"]');
    slide?.addEventListener("keydown", event => {
      event.preventDefault();
    });

    if (slide) fireEvent.keyDown(slide, { key: "ArrowRight" });

    expect(scrollNext).not.toHaveBeenCalled();
  });
});
