import type { ProgressProvider } from "@bprogress/next/app";
import type React from "react";

import { describe, expectTypeOf, it } from "vitest";

import type { ProgressBarConfig } from "./progress-bar";

/**
 * The one thing the framework-neutral progress bar config has to keep doing:
 * reach `@bprogress/next` unchanged.
 *
 * `views/layouts/provider.tsx` spreads the config straight into
 * `ProgressProvider`, so a field that is renamed, retyped or widened out of
 * shape breaks the Next.js app. Asserting the assignment here fails
 * `pnpm test:types` instead, which is where a type mistake belongs.
 */
describe("ProgressBarConfig", () => {
  it("is assignable to the Next.js progress provider's props", () => {
    expectTypeOf<ProgressBarConfig>().toExtend<
      React.ComponentProps<typeof ProgressProvider>
    >();
  });
});
