import { describe, expect, it } from 'vitest';

import { cookieFromStringToObject } from './cookie-from-string-to-object';

describe('cookieFromStringToObject', () => {
  it('should parse a simple cookie string', () => {
    const cookies = ['token=abc123; Path=/; HttpOnly'];
    const result = cookieFromStringToObject(cookies);

    expect(result).toEqual([
      {
        token: 'abc123',
        Path: '/',
        HttpOnly: true,
      },
    ]);
  });

  it('should parse multiple cookie attributes', () => {
    const cookies = [
      'sessionId=xyz789; Domain=example.com; Path=/; HttpOnly; Secure; SameSite=strict; Expires=Wed, 21 Oct 2025 07:28:00 GMT',
    ];
    const result = cookieFromStringToObject(cookies);

    expect(result).toEqual([
      {
        sessionId: 'xyz789',
        Domain: 'example.com',
        Path: '/',
        HttpOnly: true,
        Secure: true,
        SameSite: 'strict',
        Expires: 'Wed, 21 Oct 2025 07:28:00 GMT',
      },
    ]);
  });

  it('should handle multiple cookies', () => {
    const cookies = [
      'token=abc123; Path=/; HttpOnly',
      'theme=dark; Path=/; SameSite=lax',
    ];
    const result = cookieFromStringToObject(cookies);

    expect(result).toEqual([
      {
        token: 'abc123',
        Path: '/',
        HttpOnly: true,
      },
      {
        theme: 'dark',
        Path: '/',
        SameSite: 'lax',
      },
    ]);
  });

  it('should handle URL encoded values', () => {
    const cookies = ['data=hello%20world; Path=/'];
    const result = cookieFromStringToObject(cookies);

    expect(result).toEqual([
      {
        data: 'hello world',
        Path: '/',
      },
    ]);
  });

  it('should handle boolean flags without values', () => {
    const cookies = ['token=123; HttpOnly; Secure'];
    const result = cookieFromStringToObject(cookies);

    expect(result).toEqual([
      {
        token: '123',
        HttpOnly: true,
        Secure: true,
      },
    ]);
  });
});
