import { describe, expect, it } from "vitest";

import { paymentsSearch } from "./payments-search";

describe("paymentsSearch", () => {
  it("keeps a purchase id, a currency and a canceled return", () => {
    expect(
      paymentsSearch({
        checkout: "canceled",
        currency: "USD",
        purchase: "0f8fad5b-d9cb-469f-a165-70867728950e",
      }),
    ).toEqual({
      checkout: "canceled",
      currency: "USD",
      purchase: "0f8fad5b-d9cb-469f-a165-70867728950e",
    });
  });

  it("drops anything that is not one of those", () => {
    expect(
      paymentsSearch({
        checkout: "paid",
        currency: "usd",
        purchase: "../../admin",
        redirect: "https://evil.example",
      }),
    ).toEqual({});
  });
});
