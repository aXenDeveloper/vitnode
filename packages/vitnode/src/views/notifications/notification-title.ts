export interface NotificationTitlePart {
  emphasis: boolean;
  start: number;
  text: string;
}

const QUOTED_PATTERNS = ['"[^"]+"', "“[^”]+”", "„[^”“]+[”“]", "«[^»]+»"];

const escapeRegExp = (value: string) =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

const unquote = (value: string) => {
  const first = value.at(0);

  return first && `"“„«`.includes(first) ? value.slice(1, -1) : value;
};

/**
 * Splits a notification title into plain and emphasized parts: the actors'
 * names and quoted subjects (`"Welcome"`, `“Welcome”`, `„Welcome”`, `«Welcome»`)
 * are emphasized, and the quotes around a subject are dropped. Titles are
 * plain text from the API, so this never parses markup.
 *
 * @example
 * splitNotificationTitle('Ada commented on "Welcome"', ["Ada"]);
 * // [{ emphasis: true, start: 0, text: "Ada" },
 * //  { emphasis: false, start: 3, text: " commented on " },
 * //  { emphasis: true, start: 17, text: "Welcome" }]
 */
export const splitNotificationTitle = (
  title: string,
  actorNames: string[],
): NotificationTitlePart[] => {
  const names = [...new Set(actorNames.filter(name => name.trim() !== ""))]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  const pattern = new RegExp([...names, ...QUOTED_PATTERNS].join("|"), "g");
  const parts: NotificationTitlePart[] = [];
  let cursor = 0;

  for (const match of title.matchAll(pattern)) {
    if (match.index > cursor) {
      parts.push({
        emphasis: false,
        start: cursor,
        text: title.slice(cursor, match.index),
      });
    }
    parts.push({ emphasis: true, start: match.index, text: unquote(match[0]) });
    cursor = match.index + match[0].length;
  }

  if (cursor < title.length) {
    parts.push({ emphasis: false, start: cursor, text: title.slice(cursor) });
  }

  return parts;
};
