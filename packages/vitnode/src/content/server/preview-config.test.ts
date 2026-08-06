// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  testEditorialNoteContentType,
  testEditorialPostContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import { INSECURE_DEFAULT_CONTENT_PREVIEW_SECRET } from "../../lib/config";
import {
  assertContentPreviewConfig,
  contentPreviewConfigProblems,
  contentPreviewSecretProblem,
} from "./preview-config";

const STRONG = "unit-test-content-preview-secret-0123456789";

/** `testEditorialPostContentType` is the only fixture with preview enabled. */
const previewable = [
  { definition: testEditorialPostContentType, pluginId: "@vitnode/example" },
];
const withoutPreview = [
  { definition: testPostContentType, pluginId: "@vitnode/example" },
  { definition: testEditorialNoteContentType, pluginId: "@vitnode/example" },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("contentPreviewSecretProblem", () => {
  it("accepts 32 random-looking bytes", () => {
    expect(contentPreviewSecretProblem(STRONG)).toBeNull();
  });

  it("rejects a missing secret", () => {
    expect(contentPreviewSecretProblem(undefined)).toMatch(/not set/);
    expect(contentPreviewSecretProblem("")).toMatch(/not set/);
  });

  it("rejects the fallback that ships in the source", () => {
    // The whole reason this check exists: the value is public, so a token
    // signed with it is a token anyone can sign.
    expect(
      contentPreviewSecretProblem(INSECURE_DEFAULT_CONTENT_PREVIEW_SECRET),
    ).toMatch(/placeholder/);
  });

  it("rejects a secret short enough to attack", () => {
    expect(contentPreviewSecretProblem("hunter2")).toMatch(/shorter than 32/);
    // 31 bytes: one short, and still refused.
    expect(contentPreviewSecretProblem("a".repeat(31))).toMatch(
      /shorter than 32/,
    );
    expect(contentPreviewSecretProblem("a".repeat(32))).toBeNull();
  });

  it("counts bytes rather than characters", () => {
    // 16 emoji is 16 characters and 64 bytes. Counting characters would have
    // rejected it; counting bytes is what the key length actually is.
    expect(contentPreviewSecretProblem("🔐".repeat(16))).toBeNull();
    expect(contentPreviewSecretProblem("🔐".repeat(4))).toMatch(/shorter/);
  });
});

describe("contentPreviewConfigProblems", () => {
  it("is empty for a good secret and parseable origins", () => {
    expect(contentPreviewConfigProblems(STRONG)).toEqual([]);
  });

  it("reports an unparseable web origin", () => {
    // A preview link resolved against this would not be a link.
    vi.stubEnv("NEXT_PUBLIC_WEB_URL", "not a url");

    expect(contentPreviewConfigProblems(STRONG)).toEqual([
      expect.stringContaining("NEXT_PUBLIC_WEB_URL"),
    ]);

    vi.unstubAllEnvs();
  });

  it("reports an unparseable API origin", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");

    expect(contentPreviewConfigProblems(STRONG)).toEqual([
      expect.stringContaining("NEXT_PUBLIC_API_URL"),
    ]);

    vi.unstubAllEnvs();
  });
});

describe("assertContentPreviewConfig", () => {
  it("says nothing when no content type can be previewed", () => {
    // Nothing signs anything, so there is nothing to secure.
    expect(() =>
      assertContentPreviewConfig({
        contentTypes: withoutPreview,
        isProduction: true,
        secret: undefined,
      }),
    ).not.toThrow();
  });

  it("boots happily with a real secret", () => {
    expect(() =>
      assertContentPreviewConfig({
        contentTypes: previewable,
        isProduction: true,
        secret: STRONG,
      }),
    ).not.toThrow();
  });

  it.each([
    ["missing", undefined],
    ["the published fallback", INSECURE_DEFAULT_CONTENT_PREVIEW_SECRET],
    ["too short", "hunter2"],
  ])("refuses to boot production when the secret is %s", (_, secret) => {
    expect(() =>
      assertContentPreviewConfig({
        contentTypes: previewable,
        isProduction: true,
        secret,
      }),
    ).toThrow(/CONTENT_PREVIEW_SECRET/);
  });

  it("names the content types that made it mandatory", () => {
    expect(() =>
      assertContentPreviewConfig({
        contentTypes: previewable,
        isProduction: true,
        secret: undefined,
      }),
    ).toThrow(/test\.editorial/);
  });

  it("tells the reader how to generate one", () => {
    expect(() =>
      assertContentPreviewConfig({
        contentTypes: previewable,
        isProduction: true,
        secret: undefined,
      }),
    ).toThrow(/openssl rand/);
  });

  it("lets `next build` collect page data without the secret", () => {
    // Next imports every route module during a production build, so the API's
    // boot code runs on a machine that has no business holding a signing key.
    // The serving process still refuses to start, which is where it matters.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");

    expect(() =>
      assertContentPreviewConfig({
        contentTypes: previewable,
        secret: undefined,
      }),
    ).not.toThrow();
    expect(warn).toHaveBeenCalled();

    vi.unstubAllEnvs();
  });

  it("still refuses a production process that is actually serving", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-server");

    expect(() =>
      assertContentPreviewConfig({
        contentTypes: previewable,
        secret: undefined,
      }),
    ).toThrow(/CONTENT_PREVIEW_SECRET/);

    vi.unstubAllEnvs();
  });

  it("warns instead of throwing outside production", () => {
    // `pnpm dev` should still start. Preview itself stays switched off - the
    // routes fail closed - but a local database is not a reason to refuse boot.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(() =>
      assertContentPreviewConfig({
        contentTypes: previewable,
        isProduction: false,
        secret: undefined,
      }),
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("CONTENT_PREVIEW_SECRET"),
    );
  });
});
