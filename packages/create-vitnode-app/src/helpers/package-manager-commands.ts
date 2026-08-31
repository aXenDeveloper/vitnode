/**
 * How a package manager is asked to install, and to run a `package.json` script.
 *
 * The second is the whole reason this exists, and it is `<pm> run <script>` for
 * every one of them. Every generated README was built by replacing the string
 * `pnpm` with the chosen manager, which turns `pnpm dev` into `npm dev` - and
 * npm has no such command, so an npm project's README opened by telling its
 * reader to run something that exits 1. The bare form is a trap in the other
 * direction too: `bun build` is bun's own bundler rather than the `build`
 * script, and it would run instead of it.
 *
 * Pure, so the commands a project is told to run can be asserted without
 * generating one.
 */
export const packageManagerCommands = (packageManager: string) => ({
  install: `${packageManager} i`,
  run: (script: string) => `${packageManager} run ${script}`,
});
