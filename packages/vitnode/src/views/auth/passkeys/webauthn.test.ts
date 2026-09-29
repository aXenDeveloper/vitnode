import { WebAuthnError } from "@simplewebauthn/browser";
import { describe, expect, it } from "vitest";

import { passkeyCeremonyFailure } from "./webauthn";

const webAuthnError = (code: WebAuthnError["code"], name = "Error") =>
  new WebAuthnError({ cause: new Error(code), code, message: code, name });

describe("passkeyCeremonyFailure", () => {
  it("treats a closed prompt as a cancellation", () => {
    expect(
      passkeyCeremonyFailure(
        webAuthnError(
          "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
          "NotAllowedError",
        ),
      ),
    ).toBe("cancelled");
    expect(
      passkeyCeremonyFailure(webAuthnError("ERROR_CEREMONY_ABORTED")),
    ).toBe("cancelled");
  });

  it("recognises an authenticator that already holds this account", () => {
    expect(
      passkeyCeremonyFailure(
        webAuthnError("ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED"),
      ),
    ).toBe("already_registered");
  });

  it("reports an authenticator that cannot do discoverable, verified passkeys", () => {
    expect(
      passkeyCeremonyFailure(
        webAuthnError(
          "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT",
        ),
      ),
    ).toBe("unsupported");
  });

  it("falls back to a generic failure", () => {
    expect(passkeyCeremonyFailure(new Error("boom"))).toBe("failed");
    expect(passkeyCeremonyFailure("not an error")).toBe("failed");
  });
});
