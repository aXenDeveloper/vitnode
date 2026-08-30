/**
 * `collections/server`, stood in for under `vitest`.
 *
 * The real module is `.source/server.ts`, written by `fumadocs-mdx/vite` and
 * built out of `import.meta.glob` over 120 MDX files. Nothing in this suite
 * needs a compiled document - every docs assertion here is static, by the
 * migration testing policy - but plenty of tests build the router, the router
 * imports every route file, and `_docs/docs.$.tsx` reaches the transport that
 * reaches the loader. Without this alias each of those tests would compile the
 * whole documentation.
 *
 * It is an *empty* collection rather than a throwing one on purpose: a stub that
 * throws would turn "this test happens to construct the router" into a failure,
 * which is the opposite of standing in. `source.getPage()` answers `undefined`,
 * which is a documentation site with no documents in it - a shape the code under
 * test handles, because it is what a missing page looks like.
 *
 * Aliased in `vitest.config.ts`, beside the four TanStack Start virtual modules
 * that are stubbed for the same reason.
 */
export const docs = {
  docs: [],
  meta: [],
  toFumadocsSource: () => ({ files: [] }),
}
