import { buildModule } from '@/api/lib/module';

import { sessionRoute } from './routes/session.route';
import { signInRoute } from './routes/sign-in.route';
import { signOutRoute } from './routes/sign-out.route';
import { signUpRoute } from './routes/sign-up.route';
import { ssoUserModule } from './sso/sso.module';

export const usersModule = buildModule({
  plugin: 'core',
  name: 'users',
  // TODO: Add other modules
  routes: [sessionRoute, signInRoute, signOutRoute, signUpRoute],
});

export type UsersTypes = typeof usersModule;
