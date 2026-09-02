import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";

import { defineWorkflow } from "./define";

const input = z.object({
  currency: z.string(),
  orderId: z.number().int().positive(),
});

describe("workflow input typing", () => {
  it("gives every step the parsed input type", () => {
    defineWorkflow({
      id: "place-order",
      input,
      steps: ({ step }) => [
        step({
          id: "reserve-inventory",
          run: ctx => {
            expectTypeOf(ctx.input).toEqualTypeOf<{
              currency: string;
              orderId: number;
            }>();
            expectTypeOf(ctx.idempotencyKey).toEqualTypeOf<string>();
            expectTypeOf(ctx.attempt).toEqualTypeOf<number>();

            return undefined;
          },
        }),
      ],
      version: 1,
    });
  });

  it("keeps the schema on the definition, so `start()` can type its argument", () => {
    const workflow = defineWorkflow({
      id: "place-order",
      input,
      steps: ({ step }) => [step({ id: "reserve", run: () => undefined })],
      version: 1,
    });

    expectTypeOf(workflow.input).toEqualTypeOf(input);
    expectTypeOf<z.input<(typeof workflow)["input"]>>().toEqualTypeOf<{
      currency: string;
      orderId: number;
    }>();
  });
});

describe("step output typing", () => {
  it("types `compensate` from what `run` returns", () => {
    defineWorkflow({
      id: "place-order",
      input,
      steps: ({ step }) => [
        step({
          id: "reserve-inventory",
          compensate: ctx => {
            expectTypeOf(ctx.output).toEqualTypeOf<{ reservationId: number }>();
            expectTypeOf(ctx.idempotencyKey).toEqualTypeOf<string>();
          },
          run: () => ({ reservationId: 1 }),
        }),
      ],
      version: 1,
    });
  });

  it("types `compensate` through an async `run`", () => {
    defineWorkflow({
      id: "place-order",
      input,
      steps: ({ step }) => [
        step({
          id: "authorize-payment",
          compensate: ctx => {
            expectTypeOf(ctx.output).toEqualTypeOf<{ chargeId: string }>();
          },
          run: async () => await Promise.resolve({ chargeId: "ch_1" }),
        }),
      ],
      version: 1,
    });
  });

  it("checks the declared `output` schema against what `run` returns", () => {
    defineWorkflow({
      id: "place-order",
      input,
      steps: ({ step }) => [
        step({
          id: "reserve-inventory",
          output: z.object({ reservationId: z.number() }),
          // @ts-expect-error `run` must return what `output` describes.
          run: () => ({ reservationId: "not-a-number" }),
        }),
      ],
      version: 1,
    });
  });
});
