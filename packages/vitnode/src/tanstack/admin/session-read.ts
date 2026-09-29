import type { AdminSessionRead } from "./state";

import {
  adminSessionFailureFromError,
  adminSessionReadFromStatus,
} from "./state";

export interface AdminSessionReadOptions {
  passive?: boolean;
}

/**
 * What one read of the admin session endpoint saw: the status, and the body if
 * the status was the one that carries a body.
 */
export interface AdminSessionAnswer<TSession> {
  session: TSession | undefined;
  status: number;
}

/**
 * One read of the admin session endpoint, whichever fetcher made the request.
 *
 * `200` is the only granted answer, `403` is a decision rather than a failure,
 * and nothing here throws - so a route guard always reaches one of the four
 * states. The body is read inside the requester and therefore inside this
 * `try`, which is what turns an unparseable `200` into a failure instead of a
 * grant carrying nothing.
 */
export const readAdminSessionThrough = async <TSession>(
  request: () => Promise<AdminSessionAnswer<TSession>>,
): Promise<AdminSessionRead<TSession>> => {
  try {
    const { session, status } = await request();

    return adminSessionReadFromStatus(status, session);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[admin] the admin session could not be read", error);

    return adminSessionFailureFromError(error);
  }
};
