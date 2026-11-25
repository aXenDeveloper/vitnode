import type { Context } from "hono";

import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { core_legal_acceptances, core_legal_versions } from "@/database/legal";

import type { LegalErrorCode } from "./contract";
import type { LegalDb } from "./state.server";

import { LEGAL_ERROR_CODES, localizeLegalContent } from "./contract";
import { lockLegalDocument, readLegalTimelineEntries } from "./state.server";
import { resolveLegalTimeline } from "./timeline";

/**
 * Throws `HTTPException(status)` whose response is the typed legal error body
 * `{ error, code, ...extra }`, so the web can branch on `code`.
 */
export const throwLegalError = (
  status: 400 | 403 | 409,
  code: LegalErrorCode,
  extra: Record<string, unknown> = {},
): never => {
  throw new HTTPException(status, {
    res: new Response(
      JSON.stringify({ code, error: code.toLowerCase(), ...extra }),
      {
        headers: {
          "cache-control": "no-store",
          "content-type": "application/json",
        },
        status,
      },
    ),
  });
};

export interface RecordTermsAcceptanceArgs {
  /** The language of the snapshot the member saw. */
  locale: string;
  source: "gate" | "signup";
  userId: number;
  /** The exact Terms version the member saw and accepted. */
  versionId: number;
}

export interface RecordedTermsAcceptance {
  acceptedAt: Date;
  /** `false` when this member had already accepted the version. */
  created: boolean;
  id: number;
  version: number;
  versionId: number;
}

/**
 * Records that a member accepted the *effective* Terms version, inside `tx`.
 * Takes the shared legal lock first, so it cannot interleave with a
 * publication, then checks the version against the database (not the cache):
 * any other version answers `409 TERMS_VERSION_CHANGED` with the current one.
 * Accepting the same version twice returns the first record. The wording
 * stored is the version's checkbox label in the snapshot's language, or the
 * default wording from `defaultWording` when staff left it empty.
 * Server-only.
 *
 * @throws `HTTPException(409)` with `TERMS_VERSION_CHANGED`.
 */
export const recordTermsAcceptance = async (
  tx: LegalDb,
  { locale, source, userId, versionId }: RecordTermsAcceptanceArgs,
  defaultWording: (args: {
    locale: string;
    title: string;
    version: number;
  }) => Promise<string> | string,
): Promise<RecordedTermsAcceptance> => {
  await lockLegalDocument(tx, "terms", "shared");
  const { current } = resolveLegalTimeline(
    await readLegalTimelineEntries(tx),
    "terms",
  );

  if (current?.id !== versionId) {
    return throwLegalError(409, LEGAL_ERROR_CODES.versionChanged, {
      current: current ? { id: current.id, version: current.version } : null,
    });
  }

  const [existing] = await tx
    .select()
    .from(core_legal_acceptances)
    .where(
      and(
        eq(core_legal_acceptances.userId, userId),
        eq(core_legal_acceptances.versionId, versionId),
      ),
    )
    .limit(1);
  if (existing) {
    return {
      acceptedAt: existing.acceptedAt,
      created: false,
      id: existing.id,
      version: current.version,
      versionId,
    };
  }

  const [version] = await tx
    .select()
    .from(core_legal_versions)
    .where(eq(core_legal_versions.id, versionId))
    .limit(1);
  if (!version) {
    return throwLegalError(409, LEGAL_ERROR_CODES.versionChanged, {
      current: null,
    });
  }

  const snapshot = localizeLegalContent(
    version,
    locale,
    version.defaultLanguageCode,
  );
  const wording =
    snapshot.acceptanceLabel ||
    (await defaultWording({
      locale: snapshot.locale,
      title: snapshot.title,
      version: version.version,
    }));

  const [inserted] = await tx
    .insert(core_legal_acceptances)
    .values({ locale: snapshot.locale, source, userId, versionId, wording })
    .onConflictDoNothing()
    .returning();

  if (inserted) {
    return {
      acceptedAt: inserted.acceptedAt,
      created: true,
      id: inserted.id,
      version: version.version,
      versionId,
    };
  }

  // A concurrent duplicate submission won the insert: answer with its row.
  const [raced] = await tx
    .select()
    .from(core_legal_acceptances)
    .where(
      and(
        eq(core_legal_acceptances.userId, userId),
        eq(core_legal_acceptances.versionId, versionId),
      ),
    )
    .limit(1);
  if (!raced) throw new Error("Terms acceptance vanished after a conflict");

  return {
    acceptedAt: raced.acceptedAt,
    created: false,
    id: raced.id,
    version: version.version,
    versionId,
  };
};

/**
 * The default checkbox wording, translated on the server because it is kept
 * as evidence, not shown by the UI. Server-only.
 */
export const defaultTermsWording =
  (c: Context) =>
  async ({
    locale,
    title,
    version,
  }: {
    locale: string;
    title: string;
    version: number;
  }): Promise<string> => {
    const i18n = c.get("i18n");
    const t = await i18n.getTranslator(i18n.resolveSupportedLocale(locale));

    return t("core.legal.acceptance.default_wording", { title, version });
  };

/**
 * Password sign-up: when a Terms version is effective, the member must send
 * the exact version they were shown and accept it. Runs inside the sign-up
 * transaction, so the account and its acceptance commit together. Does
 * nothing while no Terms version is effective. Server-only.
 *
 * @throws `HTTPException(400)` with `TERMS_ACCEPTANCE_MISSING`, or `409`
 * with `TERMS_VERSION_CHANGED`.
 */
export const recordSignUpTermsAcceptance = async (
  c: Context,
  tx: LegalDb,
  userId: number,
  terms:
    | null
    | undefined
    | { accepted: true; locale: string; versionId: number },
): Promise<null | RecordedTermsAcceptance> => {
  // Installs without effective Terms keep the old sign-up path: no lock, no
  // record. A version that takes effect a moment later is accepted on the
  // acceptance page instead.
  const { current } = resolveLegalTimeline(
    await readLegalTimelineEntries(tx),
    "terms",
  );
  if (!current) return null;
  if (!terms) {
    return throwLegalError(400, LEGAL_ERROR_CODES.acceptanceMissing, {
      current: { id: current.id, version: current.version },
    });
  }

  return await recordTermsAcceptance(
    tx,
    {
      locale: terms.locale,
      source: "signup",
      userId,
      versionId: terms.versionId,
    },
    defaultTermsWording(c),
  );
};
