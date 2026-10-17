export const escapeHtml = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const KEYWORDS = new Set([
  "async",
  "await",
  "class",
  "const",
  "else",
  "export",
  "extends",
  "false",
  "for",
  "from",
  "function",
  "if",
  "import",
  "in",
  "interface",
  "let",
  "new",
  "null",
  "of",
  "return",
  "throw",
  "true",
  "type",
  "typeof",
  "undefined",
  "var",
  "void",
]);

const TOKEN =
  /(\/\/.*$)|(`(?:\\.|[^`])*`|'(?:\\.|[^'])*'|"(?:\\.|[^"])*")|(\/\^(?:\\.|[^/])+\/[a-z]*)|([A-Za-z_$][\w$]*)(?=\s*[(<])|([A-Za-z_$][\w$]*)|(\d+)|([{}()[\];,.:?=<>|!&+\-*/]+)/g;

const tokenClass = (groups: (string | undefined)[], token: string) => {
  const [comment, text, regex, call, identifier, digits, punctuation] = groups;

  if (comment) return "tk-c";
  if (text || regex || digits) return "tk-s";
  if (KEYWORDS.has(token)) return "tk-k";
  if (call) return "tk-f";
  if (identifier && /^[A-Z]/.test(identifier)) return "tk-t";
  if (punctuation) return "tk-p";

  return null;
};

export const highlightLine = (line: string): string => {
  let html = "";
  let last = 0;

  for (const match of line.matchAll(TOKEN)) {
    const [token, ...groups] = match;
    html += escapeHtml(line.slice(last, match.index));
    last = match.index + token.length;

    const className = tokenClass(groups, token);
    html += className
      ? `<span class="${className}">${escapeHtml(token)}</span>`
      : escapeHtml(token);
  }

  return html + escapeHtml(line.slice(last));
};
