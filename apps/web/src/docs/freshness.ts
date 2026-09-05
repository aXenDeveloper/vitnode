export const DOCS_TREE_STALE_TIME = import.meta.env.PROD ? Infinity : 0

export const memoizePerSource = <TSource extends object, TValue>(
  loadSource: () => Promise<TSource>,
  compute: (source: TSource) => Promise<TValue>,
): (() => Promise<TValue>) => {
  const cache = new WeakMap<TSource, Promise<TValue>>()

  return async (): Promise<TValue> => {
    const source = await loadSource()
    const cached = cache.get(source)

    if (cached) return await cached

    // Stored before it is awaited, so two simultaneous first requests build one
    // index rather than two.
    const value = compute(source)
    cache.set(source, value)

    return await value
  }
}
