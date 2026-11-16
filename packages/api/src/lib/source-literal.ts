/**
 * Turns a JavaScript string into a single-quoted TypeScript literal.
 *
 * Every value that reaches this has already been matched against a pattern that
 * cannot contain a quote, a backslash or a newline, so in practice it escapes
 * nothing. It exists anyway, and is tested directly: this is a code generator,
 * and a code generator that concatenates unescaped strings is one refactor away
 * from writing whatever a plugin's `package.json` says into an app's source.
 */
export const toSingleQuotedLiteral = (value: string): string =>
  `'${value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")}'`;
