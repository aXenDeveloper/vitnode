import { describe, expect, it } from "vitest";

import {
  CONTENT_BULK_CONCURRENCY,
  contentBulkActions,
  runContentBulkAction,
} from "./bulk-actions-model";

describe("contentBulkActions", () => {
  it("offers publish, unpublish and delete to an administrator who may do all three", () => {
    expect(
      contentBulkActions({
        canDelete: true,
        canPublish: true,
        publication: true,
      }),
    ).toEqual(["publish", "unpublish", "delete"]);
  });

  it("drops publication actions for a content type without publication", () => {
    expect(
      contentBulkActions({
        canDelete: true,
        canPublish: true,
        publication: false,
      }),
    ).toEqual(["delete"]);
  });

  it("drops every action the administrator lacks permission for", () => {
    expect(
      contentBulkActions({
        canDelete: false,
        canPublish: true,
        publication: true,
      }),
    ).toEqual(["publish", "unpublish"]);
    expect(
      contentBulkActions({
        canDelete: false,
        canPublish: false,
        publication: true,
      }),
    ).toEqual([]);
  });
});

describe("runContentBulkAction", () => {
  it("reports successes in selection order, and conflicts apart from failures", async () => {
    const statuses: Record<number, number> = { 1: 200, 2: 409, 3: 500, 4: 200 };

    const result = await runContentBulkAction([4, 3, 2, 1], async id => {
      await Promise.resolve();
      const status = statuses[id];

      return status === 200 ? { status } : { error: "refused", status };
    });

    expect(result).toEqual({ conflicted: 1, failed: 1, succeeded: [4, 1] });
  });

  it("counts a thrown request as a failure and still runs the rest", async () => {
    const ran: number[] = [];

    const result = await runContentBulkAction([1, 2, 3], async id => {
      ran.push(id);
      if (id === 2) throw new Error("network");

      return await Promise.resolve({ status: 200 });
    });

    expect(ran).toEqual([1, 2, 3]);
    expect(result).toEqual({ conflicted: 0, failed: 1, succeeded: [1, 3] });
  });

  it(`never runs more than ${CONTENT_BULK_CONCURRENCY} requests at once`, async () => {
    let inFlight = 0;
    let peak = 0;

    await runContentBulkAction(
      Array.from({ length: 20 }, (_, index) => index + 1),
      async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise(resolve => setTimeout(resolve, 1));
        inFlight -= 1;

        return { status: 200 };
      },
    );

    expect(peak).toBe(CONTENT_BULK_CONCURRENCY);
  });
});
