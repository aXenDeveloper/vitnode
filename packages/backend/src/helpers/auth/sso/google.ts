import { SSOAuthItem } from './sso.service';

export const googleSSO: SSOAuthItem = {
  name: 'Google',
  code: 'google',
  getUrl: ({ redirect_uri, client_id }) => {
    const params = new URLSearchParams({
      client_id,
      redirect_uri,
      response_type: 'code',
      scope: 'openid profile email',
    });

    return {
      url: `https://accounts.google.com/o/oauth2/auth?${params}`,
    };
  },
  callback: async ({ client_id, client_secret, code, redirect_uri }) => {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id,
        client_secret,
        code,
        redirect_uri,
        grant_type: 'authorization_code',
      }),
    });

    return await res.json();
  },
  registerCallback: async ({ access_token }) => {
    const res = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    const data = await res.json();

    return {
      email: data.email,
      id: data.id,
      name: data.name,
      verified_email: data.verified_email,
    };
  },
};
