const ITEM_SELECTOR =
  '[data-sidebar="menu-button"], [data-sidebar="menu-sub-button"]';
const ANIMATING_PANEL_SELECTOR = "[data-starting-style], [data-ending-style]";

const isShown = (item: Element) =>
  item.getClientRects().length > 0 && !item.closest(ANIMATING_PANEL_SELECTOR);

const findActiveItem = (area: HTMLElement) => {
  const activeItems = [
    ...area.querySelectorAll(`:is(${ITEM_SELECTOR})[data-active]`),
  ].filter(isShown);

  return (
    activeItems.find(item =>
      item.matches('[data-sidebar="menu-sub-button"]'),
    ) ??
    activeItems[0] ??
    null
  );
};

const itemOf = (target: EventTarget | null) =>
  target instanceof Element ? target.closest(ITEM_SELECTOR) : null;

const createIndicator = (area: HTMLElement, indicator: HTMLElement) => {
  let current: Element | null = null;

  const measure = (item: Element) => {
    const rect = item.getBoundingClientRect();
    const origin = area.getBoundingClientRect();
    const width = item instanceof HTMLElement ? item.offsetWidth : rect.width;
    const height =
      item instanceof HTMLElement ? item.offsetHeight : rect.height;
    const left =
      rect.left + rect.width / 2 - width / 2 - origin.left - area.clientLeft;
    const top =
      rect.top + rect.height / 2 - height / 2 - origin.top - area.clientTop;

    return {
      height: `${height}px`,
      translate: `${left + area.scrollLeft}px ${top + area.scrollTop}px`,
      width: `${width}px`,
    };
  };

  const place = (box: ReturnType<typeof measure>) => {
    indicator.style.translate = box.translate;
    indicator.style.width = box.width;
    indicator.style.height = box.height;
  };

  const isPlacedAt = (box: ReturnType<typeof measure>) =>
    indicator.style.translate === box.translate &&
    indicator.style.width === box.width &&
    indicator.style.height === box.height;

  const show = (item: Element | null, isVisible = true) => {
    if (!item) {
      if (current) indicator.style.transitionProperty = "opacity";
      current = null;
      indicator.style.opacity = "0";

      return;
    }

    const box = measure(item);
    if (item === current) {
      if (!isPlacedAt(box)) {
        indicator.style.transitionProperty = "none";
        place(box);
      }
    } else {
      indicator.style.transitionProperty = current ? "" : "opacity";
      current = item;
      place(box);
    }
    indicator.style.opacity = isVisible ? "1" : "0";
  };

  return {
    get current() {
      return current;
    },
    show,
  };
};

export const glideSidebarIndicators = (area: HTMLElement) => {
  const hoverElement = area.querySelector(
    ':scope > [data-sidebar="hover-indicator"]',
  );
  const activeElement = area.querySelector(
    ':scope > [data-sidebar="active-indicator"]',
  );
  if (
    !(hoverElement instanceof HTMLElement) ||
    !(activeElement instanceof HTMLElement)
  ) {
    return () => undefined;
  }

  const hover = createIndicator(area, hoverElement);
  const active = createIndicator(area, activeElement);
  let hoveredItem: Element | null = null;

  const showHover = (item: Element | null) => {
    hoveredItem = item;
    hover.show(item, item !== active.current);
  };

  const sync = () => {
    const activeItem = findActiveItem(area);
    active.show(activeItem);
    showHover(hoveredItem?.isConnected ? hoveredItem : null);
  };

  const resizeObserver = new ResizeObserver(sync);
  const observeLayout = () => {
    resizeObserver.observe(area);
    area
      .querySelectorAll(
        `[data-sidebar="menu"], [data-sidebar="menu-sub"], ${ITEM_SELECTOR}`,
      )
      .forEach(element => {
        resizeObserver.observe(element);
      });
  };

  const mutationObserver = new MutationObserver(() => {
    observeLayout();
    sync();
  });
  mutationObserver.observe(area, {
    attributeFilter: [
      "data-active",
      "data-starting-style",
      "data-ending-style",
    ],
    attributes: true,
    childList: true,
    subtree: true,
  });

  const controller = new AbortController();
  const { signal } = controller;

  area.addEventListener(
    "pointerover",
    event => {
      const item = itemOf(event.target);
      if (item && event.pointerType === "mouse") showHover(item);
    },
    { signal },
  );
  area.addEventListener(
    "pointerleave",
    () => {
      showHover(null);
    },
    { signal },
  );
  area.addEventListener(
    "focusin",
    event => {
      if (
        event.target instanceof Element &&
        event.target.matches(":focus-visible")
      ) {
        showHover(itemOf(event.target));
      }
    },
    { signal },
  );
  area.addEventListener(
    "focusout",
    () => {
      if (!area.matches(":hover")) showHover(null);
    },
    { signal },
  );

  observeLayout();
  sync();
  area.dataset.glide = "";

  return () => {
    controller.abort();
    resizeObserver.disconnect();
    mutationObserver.disconnect();
    delete area.dataset.glide;
  };
};
