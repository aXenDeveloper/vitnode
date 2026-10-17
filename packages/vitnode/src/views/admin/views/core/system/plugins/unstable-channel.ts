import { prerelease } from "semver";

const LABELS: Record<string, string> = {
  dev: "Dev",
  rc: "RC",
};

export const unstableChannelOf = (version: string): null | string => {
  const [tag] = prerelease(version) ?? [];
  if (tag === undefined) return null;
  if (typeof tag === "number") return "prerelease";

  const name = tag.replace(/[^a-z]/gi, "").toLowerCase();

  return name === "" ? "prerelease" : name;
};

export const unstableChannelLabel = (channel: string): string =>
  LABELS[channel] ?? `${channel.charAt(0).toUpperCase()}${channel.slice(1)}`;
