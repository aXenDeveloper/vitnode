import type { RequestServerOptions } from "@tanstack/react-start";

type SsoFormPostContext = Pick<
  RequestServerOptions<unknown, unknown>,
  "handlerType" | "next" | "request"
>;

const SSO_CALLBACK_PATH = /\/login\/sso\/[\w-]{1,255}\/?$/;

const FORWARDED_FIELDS = ["code", "state", "error"] as const;

const FIELD_MAX_LENGTH = 4096;

const NAME_MAX_LENGTH = 64;

const nameOf = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0
    ? value.trim().slice(0, NAME_MAX_LENGTH)
    : undefined;

/**
 * Apple's `user` field, reduced to the name - the only part core reads from
 * it. The email inside is unsigned; the address comes from the ID token.
 */
const providerUserOf = (raw: FormDataEntryValue | null): string | undefined => {
  if (typeof raw !== "string" || raw.length > FIELD_MAX_LENGTH) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (typeof parsed !== "object" || parsed === null) return;

  const name = (parsed as { name?: unknown }).name;
  if (typeof name !== "object" || name === null) return;

  const firstName = nameOf((name as { firstName?: unknown }).firstName);
  const lastName = nameOf((name as { lastName?: unknown }).lastName);
  if (!(firstName || lastName)) return;

  return JSON.stringify({ name: { firstName, lastName } });
};

/**
 * Turns a provider's `form_post` callback (Apple's, when it shares a name or
 * an email) into the `GET` the SSO callback page handles.
 *
 * The POST arrives cross-site, so the `SameSite=Lax` cookie that binds the
 * sign-in attempt to this browser is not sent with it. A `303` back to the same
 * URL is a top-level `GET` navigation, which does carry it - so the attempt is
 * checked exactly as for every other provider, and no cookie or CSRF rule is
 * relaxed. Only `code`, `state`, `error` and the name from `user` are carried
 * over; nothing is trusted here.
 */
export const runSsoFormPost = async ({
  handlerType,
  next,
  request,
}: SsoFormPostContext) => {
  if (handlerType !== "router" || request.method !== "POST") {
    return await next();
  }

  const url = new URL(request.url);
  const contentType = request.headers.get("content-type") ?? "";
  if (
    !SSO_CALLBACK_PATH.test(url.pathname) ||
    !contentType.startsWith("application/x-www-form-urlencoded")
  ) {
    return await next();
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response(null, { status: 400 });
  }

  const target = new URL(url.pathname, url.origin);
  for (const field of FORWARDED_FIELDS) {
    const value = form.get(field);
    if (typeof value === "string" && value.length <= FIELD_MAX_LENGTH) {
      target.searchParams.set(
        field,
        field === "error" && value === "user_cancelled_authorize"
          ? "access_denied"
          : value,
      );
    }
  }
  const user = providerUserOf(form.get("user"));
  if (user) target.searchParams.set("user", user);

  return new Response(null, {
    headers: {
      "Cache-Control": "no-store",
      Location: `${target.pathname}${target.search}`,
      "Referrer-Policy": "no-referrer",
    },
    status: 303,
  });
};
