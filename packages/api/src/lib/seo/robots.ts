/**
 * User agents of crawlers that collect pages to train AI models. Search and
 * user-triggered assistants (Googlebot, Bingbot, ChatGPT-User,
 * PerplexityBot) are not listed: blocking those hides the site from search
 * and answers, not from training sets.
 */
export const AI_TRAINING_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Bytespider",
  "meta-externalagent",
  "FacebookBot",
  "cohere-training-data-crawler",
  "Diffbot",
  "Omgilibot",
  "ImagesiftBot",
  "PanguBot",
  "Timpibot",
] as const;

/** Private areas every VitNode site keeps out of crawlers' way. */
export const DEFAULT_ROBOTS_DISALLOW = [
  "/admin",
  "/settings",
  "/modcp",
  "/notifications",
  "/files",
] as const;

export interface RobotsTxtInput {
  /** `false` answers `Disallow: /` for everyone and nothing else. */
  allowIndexing: boolean;
  blockAiCrawlers: boolean;
  /** Appended after the generated groups, as written. */
  customRobots: string;
  /** Paths disallowed for every crawler, already localized. */
  disallow: readonly string[];
  /** While the site is offline the file says so in a comment. */
  offline?: boolean;
  /** Absolute URL of the sitemap index, or `null` when sitemaps are off. */
  sitemapUrl: null | string;
}

// oxlint-disable-next-line no-control-regex -- stripping them is the point
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B-\u001F\u007F]/g;

/** Custom rules with Unix line endings, no control characters and no trailing blank lines. */
export const normalizeCustomRobots = (value: string): string =>
  value
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARACTERS, "")
    .split("\n")
    .map(line => line.trimEnd())
    .join("\n")
    .trim();

/**
 * The `robots.txt` body. Pure and browser-safe, so the AdminCP previews
 * exactly what `/robots.txt` serves.
 *
 * @example
 * buildRobotsTxt({
 *   allowIndexing: true,
 *   blockAiCrawlers: false,
 *   customRobots: "",
 *   disallow: ["/admin"],
 *   sitemapUrl: "https://example.com/sitemap.xml",
 * });
 */
export const buildRobotsTxt = ({
  allowIndexing,
  blockAiCrawlers,
  customRobots,
  disallow,
  offline = false,
  sitemapUrl,
}: RobotsTxtInput): string => {
  if (!allowIndexing) {
    return [
      "# Search engine indexing is turned off for this site.",
      "User-agent: *",
      "Disallow: /",
      "",
    ].join("\n");
  }

  const lines: string[] = [];
  if (offline) {
    lines.push(
      "# The site is offline for maintenance. Please come back later.",
    );
  }

  lines.push("User-agent: *");
  const paths = [...new Set(disallow)];
  if (paths.length === 0) {
    lines.push("Allow: /");
  } else {
    for (const path of paths) lines.push(`Disallow: ${path}`);
  }

  if (blockAiCrawlers) {
    lines.push("");
    for (const agent of AI_TRAINING_CRAWLERS) {
      lines.push(`User-agent: ${agent}`);
    }
    lines.push("Disallow: /");
  }

  const custom = normalizeCustomRobots(customRobots);
  if (custom) lines.push("", custom);

  if (sitemapUrl) lines.push("", `Sitemap: ${sitemapUrl}`);

  return `${lines.join("\n")}\n`;
};
