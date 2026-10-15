export const whenIdle = (callback: () => void) => {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(callback, { timeout: 2000 })

    return () => {
      cancelIdleCallback(id)
    }
  }

  const id = setTimeout(callback, 200)

  return () => {
    clearTimeout(id)
  }
}
