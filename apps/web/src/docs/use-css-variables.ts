import React from 'react'

const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributeFilter: ['class', 'style', 'data-theme'],
    attributes: true,
  })

  return () => observer.disconnect()
}

const getServerSnapshot = () => '{}'

export const useCssVariables = (names: readonly string[]) => {
  const getSnapshot = React.useCallback(() => {
    const styles = getComputedStyle(document.documentElement)

    return JSON.stringify(
      Object.fromEntries(
        names.map((name) => [
          name,
          styles.getPropertyValue(`--${name}`).trim(),
        ]),
      ),
    )
  }, [names])

  const snapshot = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )

  return React.useMemo(
    () => JSON.parse(snapshot) as Record<string, string>,
    [snapshot],
  )
}
