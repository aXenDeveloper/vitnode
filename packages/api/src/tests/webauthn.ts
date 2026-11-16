import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";

import { isoBase64URL, isoCBOR } from "@simplewebauthn/server/helpers";
import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign,
} from "node:crypto";

const FLAG_USER_PRESENT = 0x01;
const FLAG_USER_VERIFIED = 0x04;
const FLAG_BACKUP_ELIGIBLE = 0x08;
const FLAG_BACKED_UP = 0x10;
const FLAG_ATTESTED_CREDENTIAL = 0x40;

const COSE_KTY_EC2 = 2;
const COSE_ALG_ES256 = -7;
const COSE_CRV_P256 = 1;

type Bytes = Uint8Array<ArrayBuffer>;

const sha256 = (data: Uint8Array): Bytes =>
  new Uint8Array(createHash("sha256").update(data).digest());

const concat = (...parts: Uint8Array[]): Bytes => {
  const out = new Uint8Array(
    parts.reduce((size, part) => size + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }

  return out;
};

const uint32 = (value: number): Bytes => {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value);

  return out;
};

const uint16 = (value: number): Bytes => {
  const out = new Uint8Array(2);
  new DataView(out.buffer).setUint16(0, value);

  return out;
};

const encodeJson = (value: unknown): Bytes =>
  new TextEncoder().encode(JSON.stringify(value));

export interface CeremonyOverrides {
  challenge?: string;
  counter?: number;
  origin?: string;
  rpId?: string;
  userHandle?: null | string;
  userVerified?: boolean;
}

export const createSoftwareAuthenticator = ({
  aaguid = "00000000-0000-0000-0000-000000000000",
  origin,
  rpId,
}: {
  aaguid?: string;
  origin: string;
  rpId: string;
}) => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });
  const jwk = publicKey.export({ format: "jwk" });
  const credentialId = new Uint8Array(randomBytes(32));
  const aaguidBytes = new Uint8Array(
    Buffer.from(aaguid.replaceAll("-", ""), "hex"),
  );
  let counter = 0;
  let userHandle: string | undefined;

  const cosePublicKey = isoCBOR.encode(
    new Map<number, number | Uint8Array>([
      [-3, isoBase64URL.toBuffer(jwk.y ?? "")],
      [-2, isoBase64URL.toBuffer(jwk.x ?? "")],
      [-1, COSE_CRV_P256],
      [1, COSE_KTY_EC2],
      [3, COSE_ALG_ES256],
    ]),
  );

  const flags = (userVerified: boolean, extra = 0) =>
    FLAG_USER_PRESENT |
    (userVerified ? FLAG_USER_VERIFIED : 0) |
    FLAG_BACKUP_ELIGIBLE |
    FLAG_BACKED_UP |
    extra;

  const id = isoBase64URL.fromBuffer(credentialId);

  return {
    credentialId: id,

    setCounter: (value: number) => {
      counter = value;
    },

    createCredential: ({
      challenge,
      overrides = {},
      userId,
    }: {
      challenge: string;
      overrides?: CeremonyOverrides;
      userId: string;
    }): RegistrationResponseJSON => {
      userHandle = userId;
      const clientDataJSON = encodeJson({
        challenge: overrides.challenge ?? challenge,
        crossOrigin: false,
        origin: overrides.origin ?? origin,
        type: "webauthn.create",
      });
      const authData = concat(
        sha256(new TextEncoder().encode(overrides.rpId ?? rpId)),
        new Uint8Array([
          flags(overrides.userVerified ?? true, FLAG_ATTESTED_CREDENTIAL),
        ]),
        uint32(overrides.counter ?? counter),
        aaguidBytes,
        uint16(credentialId.length),
        credentialId,
        cosePublicKey,
      );
      const attestationObject = isoCBOR.encode(
        new Map<string, Map<string, string> | string | Uint8Array>([
          ["attStmt", new Map<string, string>()],
          ["authData", authData],
          ["fmt", "none"],
        ]),
      );

      return {
        clientExtensionResults: {},
        id,
        rawId: id,
        response: {
          attestationObject: isoBase64URL.fromBuffer(attestationObject),
          clientDataJSON: isoBase64URL.fromBuffer(clientDataJSON),
          transports: ["internal", "hybrid"],
        },
        type: "public-key",
      };
    },

    getAssertion: ({
      challenge,
      overrides = {},
    }: {
      challenge: string;
      overrides?: CeremonyOverrides;
    }): AuthenticationResponseJSON => {
      if (overrides.counter === undefined && counter > 0) counter += 1;
      const clientDataJSON = encodeJson({
        challenge: overrides.challenge ?? challenge,
        crossOrigin: false,
        origin: overrides.origin ?? origin,
        type: "webauthn.get",
      });
      const authenticatorData = concat(
        sha256(new TextEncoder().encode(overrides.rpId ?? rpId)),
        new Uint8Array([flags(overrides.userVerified ?? true)]),
        uint32(overrides.counter ?? counter),
      );
      const signature = sign(
        "sha256",
        concat(authenticatorData, sha256(clientDataJSON)),
        privateKey,
      );
      const handle =
        overrides.userHandle === null
          ? undefined
          : (overrides.userHandle ?? userHandle);

      return {
        clientExtensionResults: {},
        id,
        rawId: id,
        response: {
          authenticatorData: isoBase64URL.fromBuffer(authenticatorData),
          clientDataJSON: isoBase64URL.fromBuffer(clientDataJSON),
          signature: isoBase64URL.fromBuffer(new Uint8Array(signature)),
          ...(handle === undefined ? {} : { userHandle: handle }),
        },
        type: "public-key",
      };
    },
  };
};
