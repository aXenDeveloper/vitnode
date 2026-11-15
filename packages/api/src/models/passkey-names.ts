import { parseUserAgent } from "@/lib/api/parse-user-agent";
import { PASSKEY_NAME_MAX_LENGTH } from "@/lib/passkey";

const AUTHENTICATOR_NAMES: Readonly<Record<string, string>> = {
  "08987058-cadc-4b81-b6e1-30de50dcbe96": "Windows Hello",
  "50726f74-6f6e-5061-7373-50726f746f6e": "Proton Pass",
  "531126d6-e717-415c-9320-3d9aa6981239": "Dashlane",
  "53414d53-554e-4700-0000-000000000000": "Samsung Pass",
  "6028b017-b1d4-4c02-b4b3-afcdafc96bb2": "Windows Hello",
  "9ddd1817-af5a-4672-a2b9-3e3dd95000a9": "Windows Hello",
  "adce0002-35bc-c60a-648b-0b25f1f05503": "Chrome on Mac",
  "b84e4048-15dc-4dd0-8640-f4f60813c8af": "NordPass",
  "bada5566-a7aa-401f-bd96-45619a55120d": "1Password",
  "d548826e-79b4-db40-a3d8-11116f7e8349": "Bitwarden",
  "dd4ec289-e01d-41c9-bb89-70fa845d4bf2": "iCloud Keychain",
  "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4": "Google Password Manager",
  "fbfc3007-154e-4ecc-8c0b-6e020557d7bd": "iCloud Keychain",
  "fdb141b2-5d84-443e-8a35-4698c205a502": "KeePassXC",
};

const UNKNOWN_USER_AGENT_PART = "Unknown";

export const FALLBACK_PASSKEY_NAME = "Passkey";

export const normalizePasskeyName = (name: string): string =>
  name.trim().replace(/\s+/g, " ").slice(0, PASSKEY_NAME_MAX_LENGTH);

export const defaultPasskeyName = ({
  aaguid,
  userAgent,
}: {
  aaguid: null | string | undefined;
  userAgent: string | undefined;
}): string => {
  const known = aaguid ? AUTHENTICATOR_NAMES[aaguid.toLowerCase()] : undefined;
  if (known) return known;

  const { browser, os } = parseUserAgent(userAgent ?? "");
  const parts = [browser.replace(/\s+[\d.]+$/, ""), os].filter(
    part => part !== UNKNOWN_USER_AGENT_PART,
  );

  if (parts.length === 2) return `${parts[0]} (${parts[1]})`;

  return parts[0] ?? FALLBACK_PASSKEY_NAME;
};
