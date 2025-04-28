import { buildModule } from '@/api/lib/module';

import { sessionRoute } from './routes/session.route';
import { signInRoute } from './routes/sign-in.route';
import { signOutRoute } from './routes/sign-out.route';
import { signUpRoute } from './routes/sign-up.route';
import { testRoute } from './routes/test.route';
import { ssoUserModule } from './sso/sso.module';

export const usersModule = buildModule({
  plugin: 'core',
  name: 'users',
  routes: [sessionRoute, signInRoute, signOutRoute, signUpRoute, testRoute],
  modules: [ssoUserModule],
});
