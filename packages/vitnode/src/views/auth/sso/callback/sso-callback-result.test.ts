import { describe, expect, it } from "vitest";

import { ssoCallbackResultFromStatus } from "./sso-callback-result";

describe("reading an SSO callback status", () => {
  it("signs the visitor in on 200", () => {
    expect(ssoCallbackResultFromStatus(200)).toEqual({});
  });

  it("reports the email conflict on 409", () => {
    expect(ssoCallbackResultFromStatus(409)).toEqual({
      failure: "email_exists",
    });
  });

  it("reports everything else as a failure the visitor cannot resolve", () => {
    for (const status of [400, 401, 403, 404, 429, 500, 502]) {
      expect(ssoCallbackResultFromStatus(status)).toEqual({
        failure: "unknown",
      });
    }
  });
});
