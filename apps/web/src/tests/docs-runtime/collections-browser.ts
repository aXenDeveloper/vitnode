/**
 * `collections/browser`, stood in for under `vitest`. See `./collections-server`.
 *
 * The shape is `createClientLoader`'s: a preload that resolves and a `useContent`
 * that renders nothing. No test renders a document - that would be a DOM test,
 * which this migration's testing policy does not add - so what matters is only
 * that constructing the router does not pull the MDX pipeline in behind it.
 */
const browserCollections = {
  docs: {
    createClientLoader: () => ({
      getComponent: () => () => null,
      preload: async () => await Promise.resolve(undefined),
      // The name is Fumadocs' - it really is a hook in the real module, which
      // reads the compiled body through `use()`.
      // eslint-disable-next-line @eslint-react/no-unnecessary-use-prefix
      useContent: () => null,
    }),
    raw: {},
  },
}

export default browserCollections
