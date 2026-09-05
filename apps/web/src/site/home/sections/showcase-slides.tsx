import type { ScreenKey } from '#/site/marketing/screens'

export const SLIDES: { caption: string; screen: ScreenKey }[] = [
  {
    caption:
      'A dashboard you rearrange yourself. Plugins bring their own widgets, and yes, that notification widget really pushes a live toast to a member.',
    screen: 'dashboard',
  },
  {
    caption:
      'Every screen here came from one TypeScript definition. Fields, validation, rich text, uploads and a language switch per field, with zero UI code.',
    screen: 'contentEditor',
  },
  {
    caption:
      'AI, WebSockets, Redis, email, storage, cron and queues report their status in one place. Test buttons included, guessing not required.',
    screen: 'integrations',
  },
  {
    caption:
      'Roles with colours, member counts and per-plugin staff permissions. The four defaults are seeded for you; the rest is your call.',
    screen: 'roles',
  },
  {
    caption:
      'The member side is ready too: sign-in, registration, password reset and social login, with captcha waiting in the wings.',
    screen: 'login',
  },
]
