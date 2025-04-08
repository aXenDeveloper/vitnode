export const cookieFromStringToObject = (
  str: string[],
): {
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  [key: string]: 'lax' | 'none' | 'strict' | boolean | string | undefined;
  Domain: string;
  Expires: string;
  HttpOnly: boolean;
  Path: string;
  SameSite: 'lax' | 'none' | 'strict' | boolean | undefined;
  Secure: boolean;
}[] => {
  return str.map(item =>
    Object.fromEntries(
      item.split('; ').map(v => {
        const current = v.split(/=(.*)/s).map(decodeURIComponent);

        if (current.length === 1) {
          return [current[0], true];
        }

        return current;
      }),
    ),
  );
};
