import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";

import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  WebAuthnError,
} from "@simplewebauthn/browser";
import React from "react";

export type PasskeyCeremonyFailure =
  "already_registered" | "cancelled" | "failed" | "unsupported";

export type PasskeyCeremonyResult<Response> =
  | { failure: PasskeyCeremonyFailure; ok: false }
  | { ok: true; response: Response };

const CANCELLED_ERROR_NAMES = new Set(["AbortError", "NotAllowedError"]);

export const passkeyCeremonyFailure = (
  error: unknown,
): PasskeyCeremonyFailure => {
  if (error instanceof WebAuthnError) {
    if (error.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") {
      return "already_registered";
    }
    if (error.code === "ERROR_CEREMONY_ABORTED") return "cancelled";
    if (
      error.code ===
        "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT" ||
      error.code === "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT"
    ) {
      return "unsupported";
    }
  }

  if (error instanceof Error && CANCELLED_ERROR_NAMES.has(error.name)) {
    return "cancelled";
  }

  return "failed";
};

export const isPasskeySupported = (): boolean => browserSupportsWebAuthn();

const subscribeToNothing = () => () => undefined;

export const usePasskeySupport = (): boolean =>
  React.useSyncExternalStore(
    subscribeToNothing,
    isPasskeySupported,
    () => true,
  );

export const createPasskeyInBrowser = async (
  optionsJSON: PublicKeyCredentialCreationOptionsJSON,
): Promise<PasskeyCeremonyResult<RegistrationResponseJSON>> => {
  if (!isPasskeySupported()) return { failure: "unsupported", ok: false };

  try {
    return { ok: true, response: await startRegistration({ optionsJSON }) };
  } catch (error) {
    return { failure: passkeyCeremonyFailure(error), ok: false };
  }
};

export const getPasskeyInBrowser = async (
  optionsJSON: PublicKeyCredentialRequestOptionsJSON,
): Promise<PasskeyCeremonyResult<AuthenticationResponseJSON>> => {
  if (!isPasskeySupported()) return { failure: "unsupported", ok: false };

  try {
    return { ok: true, response: await startAuthentication({ optionsJSON }) };
  } catch (error) {
    return { failure: passkeyCeremonyFailure(error), ok: false };
  }
};
