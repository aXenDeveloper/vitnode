import { SSOAuthItem } from './sso.service';

export const facebookSSO: SSOAuthItem = {
  name: 'Facebook',
  code: 'facebook',
  getUrl: ({ redirect_uri, client_id }) => {
    const params = new URLSearchParams({
      client_id,
      redirect_uri,
      scope: 'email',
    });

    return {
      url: `https://www.facebook.com/dialog/oauth?${params}`,
    };
  },
  callback: async ({ client_id, client_secret, code, redirect_uri }) => {
    const params = new URLSearchParams({
      client_id,
      client_secret,
      code,
      redirect_uri,
    });

    const res = await fetch(
      `https://graph.facebook.com/oauth/access_token?${params}`,
    );

    return await res.json();
  },
  registerCallback: async ({ access_token }) => {
    const res = await fetch(
      `https://graph.facebook.com/me?access_token=${access_token}`,
    );
    const me: {
      id: string;
    } = await res.json();

    const res2 = await fetch(
      `https://graph.facebook.com/${me.id}?fields=id,name,email&access_token=${access_token}`,
    );
    const data = await res2.json();

    return {
      email: data.email,
      id: data.id,
      name: data.name,
      verified_email: true,
    };
  },
};
