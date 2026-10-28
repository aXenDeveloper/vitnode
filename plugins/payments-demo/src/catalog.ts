/**
 * The demo's only item. Its price lives on the server; the browser sends just
 * `itemId`. `title` is a message key the web translates.
 */
export const DEMO_ITEMS = {
  "sticker-pack": {
    amount: 500,
    currency: "usd",
    title: "payments-demo.items.sticker_pack.title",
  },
} as const satisfies Record<
  string,
  { amount: number; currency: string; title: string }
>;

export type DemoItemId = keyof typeof DEMO_ITEMS;

export const DEMO_ITEM_IDS = Object.keys(DEMO_ITEMS) as [
  DemoItemId,
  ...DemoItemId[],
];

/** The payment reference of a purchase: what core stores as `reference`. */
export const purchaseReference = (purchaseId: number) =>
  `purchase:${purchaseId}`;
