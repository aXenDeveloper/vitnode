/**
 * The server-only half, rigged to fail if anything build-time reaches it.
 *
 * A real one carries `() => import("./locales/...")` loaders that read a
 * package's build output, plus the `server-only` marker. This throws at module
 * scope instead, which is how `shared-config-discovery.test.ts` proves the
 * plugin generator never loads it: an assertion about a call count nobody owns
 * would pass the day the generator started importing this file and stopped
 * calling anything on it.
 */
throw new Error(
  "the server-only config was loaded by something that should only read the shared one",
);
