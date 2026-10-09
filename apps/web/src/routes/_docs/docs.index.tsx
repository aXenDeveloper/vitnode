import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_docs/docs/')({
  beforeLoad: () => {
    // oxlint-disable-next-line typescript/only-throw-error
    throw redirect({ params: { _splat: 'dev' }, to: '/docs/$' })
  },
})
