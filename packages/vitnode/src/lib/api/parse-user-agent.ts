export type DeviceType = "desktop" | "mobile" | "tablet";

export interface ParsedUserAgent {
  browser: string;
  deviceType: DeviceType;
  os: string;
}

const UNKNOWN = "Unknown";

const getOS = (ua: string): string => {
  if (ua.includes("Windows")) {
    return "Windows";
  }

  if (/iPhone|iPad|iPod/.test(ua)) {
    return "iOS";
  }

  if (ua.includes("Android")) {
    return "Android";
  }

  if (ua.includes("Mac OS X")) {
    return "Mac OS";
  }

  if (ua.includes("CrOS")) {
    return "Chrome OS";
  }

  if (ua.includes("Ubuntu")) {
    return "Ubuntu";
  }

  if (ua.includes("Linux")) {
    return "Linux";
  }

  return UNKNOWN;
};

const getBrowser = (ua: string): string => {
  let match = /Edg(?:e|A|iOS)?\/([\d.]+)/.exec(ua);
  if (match) {
    return `Edge ${match[1]}`;
  }

  match = /OPR\/([\d.]+)/.exec(ua) ?? /Opera\/([\d.]+)/.exec(ua);
  if (match) {
    return `Opera ${match[1]}`;
  }

  match = /Firefox\/([\d.]+)/.exec(ua);
  if (match) {
    return `Firefox ${match[1]}`;
  }

  match = /(?:Chrome|CriOS)\/([\d.]+)/.exec(ua);
  if (match) {
    return `Chrome ${match[1]}`;
  }

  if (ua.includes("Safari/")) {
    match = /Version\/([\d.]+)/.exec(ua);

    return match ? `Safari ${match[1]}` : "Safari";
  }

  return UNKNOWN;
};

const getDeviceType = (ua: string): DeviceType => {
  if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(ua)) {
    return "tablet";
  }

  if (/Mobi|iPhone|iPod|Windows Phone|IEMobile|BlackBerry/i.test(ua)) {
    return "mobile";
  }

  return "desktop";
};

export const parseUserAgent = (
  ua: null | string | undefined,
): ParsedUserAgent => {
  if (!ua || ua === "node") {
    return { browser: UNKNOWN, deviceType: "desktop", os: UNKNOWN };
  }

  return {
    browser: getBrowser(ua),
    deviceType: getDeviceType(ua),
    os: getOS(ua),
  };
};
