import { describe, expect, it } from "vitest";

import { helloModule } from "./hello.module";

describe("hello module", () => {
  it("answers GET / with a greeting from the plugin", async () => {
    const response = await helloModule.hono.request("/");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "Hello from newsroom!",
    });
  });
});
