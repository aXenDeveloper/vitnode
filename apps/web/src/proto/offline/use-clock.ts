import { countdownParts } from '@vitnode/core/views/site-offline/countdown-parts'
import React from 'react'

const subscribe = (onTick: () => void) => {
  const id = window.setInterval(onTick, 1000)
  document.addEventListener('visibilitychange', onTick)

  return () => {
    window.clearInterval(id)
    document.removeEventListener('visibilitychange', onTick)
  }
}

const getSnapshot = () => Math.floor(Date.now() / 1000) * 1000

export const useCountdown = (opensAt: string) => {
  const now = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return countdownParts(Date.parse(opensAt), now)
}
