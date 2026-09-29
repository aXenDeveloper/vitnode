export interface PasskeysConfig {
  origins?: string[];
  rpId?: string;
  rpName?: string;
}

export type ResolvedPasskeysConfig =
  | { enabled: false; problems: string[] }
  | { enabled: true; origins: string[]; rpId: string; rpName: string };

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

const isLocalhost = (hostname: string): boolean =>
  hostname === "localhost" || hostname.endsWith(".localhost");

const isIpAddress = (hostname: string): boolean =>
  IPV4.test(hostname) || hostname.includes(":") || hostname.startsWith("[");

const belongsToRpId = (hostname: string, rpId: string): boolean =>
  hostname === rpId || hostname.endsWith(`.${rpId}`);

const parseOrigin = (value: string): null | URL => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

export const passkeyConfigProblems = ({
  origins,
  rpId,
}: {
  origins: string[];
  rpId: string;
}): string[] => {
  const problems: string[] = [];

  if (!rpId) problems.push("The RP ID is empty.");
  else if (rpId !== rpId.toLowerCase()) {
    problems.push(`The RP ID "${rpId}" must be lowercase.`);
  } else if (isIpAddress(rpId)) {
    problems.push(
      `The RP ID "${rpId}" is an IP address. WebAuthn needs a domain name - use "localhost" in development.`,
    );
  }

  if (origins.length === 0) problems.push("No origins are configured.");

  for (const origin of origins) {
    const url = parseOrigin(origin);

    if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) {
      problems.push(`"${origin}" is not an http(s) origin.`);
      continue;
    }

    if (url.origin !== origin) {
      problems.push(
        `"${origin}" is not a bare origin. Use "${url.origin}" (no path or trailing slash).`,
      );
    }

    if (url.protocol === "http:" && !isLocalhost(url.hostname)) {
      problems.push(
        `"${origin}" uses plain HTTP. Browsers only allow passkeys on HTTPS or on localhost.`,
      );
    }

    if (rpId && !belongsToRpId(url.hostname, rpId)) {
      problems.push(
        `The RP ID "${rpId}" is neither "${url.hostname}" nor a parent domain of it.`,
      );
    }
  }

  return problems;
};

export const resolvePasskeysConfig = ({
  config,
  rpNameFallback,
  webOrigin,
}: {
  config: boolean | PasskeysConfig | undefined;
  rpNameFallback: string;
  webOrigin: string;
}): ResolvedPasskeysConfig => {
  if (!config) return { enabled: false, problems: [] };

  const overrides = config === true ? {} : config;
  const origins = overrides.origins ?? [webOrigin];
  const rpId = overrides.rpId ?? parseOrigin(origins[0] ?? "")?.hostname ?? "";
  const problems = passkeyConfigProblems({ origins, rpId });

  if (problems.length > 0) {
    throw new Error(
      `[VitNode] Passkeys are misconfigured: ${problems.join(" ")}`,
    );
  }

  return {
    enabled: true,
    origins,
    rpId,
    rpName: overrides.rpName ?? rpNameFallback,
  };
};
