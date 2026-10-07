/**
 * The longest email address or name an account can have - the width of the
 * `core_users` columns they are stored in. A longer value could never be saved,
 * so it is refused by the schema instead of by the database.
 */
export const USER_EMAIL_MAX_LENGTH = 255;
export const USER_NAME_MAX_LENGTH = 255;

/**
 * The longest password any route accepts.
 *
 * Every password is run through scrypt, and the cost of that grows with the
 * input. Without a cap an anonymous caller could post megabytes of "password"
 * to the sign-in route and make the server derive a key over all of it.
 */
export const USER_PASSWORD_MAX_LENGTH = 1024;
