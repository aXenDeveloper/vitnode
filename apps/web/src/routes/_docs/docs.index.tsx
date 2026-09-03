import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_docs/docs/')({
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({ params: { _splat: 'dev' }, to: '/docs/$' })
  },
})
