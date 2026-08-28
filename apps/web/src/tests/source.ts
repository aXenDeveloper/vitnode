import { readFileSync } from 'node:fs'

/**
 * A source file's code, with its comments removed.
 *
 * Several assertions in this suite are about *what a module does* - which route
 * it mounts a component under, which of two nearly identical cache calls its
 * loader makes, whether it renders a landmark - and the honest way to ask that
 * is to read the source. The catch is that this codebase explains itself at
 * length, and those explanations name the very things being looked for: the
 * shell's loader discusses `ensureAuthState` in order to say why it is the wrong
 * call, and every route that does *not* render a `<main>` says so in prose above
 * the component. A raw scan fails on the explanation rather than on the code.
 *
 * Shared rather than redefined per file because three tests wanted it and the
 * copies had already started to differ.
 *
 * Deliberately naive: it does not know that `//` can appear inside a string or a
 * regex, and it does not need to - it is used on this repository's own sources,
 * where a false strip would only ever remove code an assertion then fails to
 * find. It is not a parser and must not be used as one.
 */
export const withoutComments = (path: string): string =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
