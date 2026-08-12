// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  testEditorialNoteContentType,
  testEditorialPostContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import { INSECURE_DEFAULT_CONTENT_PREVIEW_SECRET } from "../../lib/config";
import {
  contentPreviewConfigProblems,
  contentPreviewSecretProblem,
  warnAboutContentPreviewConfig,
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

describe("warnAboutContentPreviewConfig", () => {
  const spyOnWarn = () =>
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

  it("says nothing when no content type can be previewed", () => {
    // Nothing signs anything, so there is nothing to secure - and nothing to
    // nag an install about.
    const warn = spyOnWarn();

    warnAboutContentPreviewConfig({
      contentTypes: withoutPreview,
      secret: undefined,
    });

    expect(warn).not.toHaveBeenCalled();
  });

  it("says nothing when the secret is real", () => {
    const warn = spyOnWarn();

    warnAboutContentPreviewConfig({
      contentTypes: previewable,
      secret: STRONG,
    });

    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", undefined],
    ["the published fallback", INSECURE_DEFAULT_CONTENT_PREVIEW_SECRET],
    ["too short", "hunter2"],
  ])("warns when the secret is %s", (_, secret) => {
    const warn = spyOnWarn();

    warnAboutContentPreviewConfig({ contentTypes: previewable, secret });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("CONTENT_PREVIEW_SECRET"),
    );
  });

  it("names the content types that wanted it", () => {
    const warn = spyOnWarn();

    warnAboutContentPreviewConfig({
      contentTypes: previewable,
      secret: undefined,
    });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("test.editorial"),
    );
  });

  it("tells the reader how to generate one, and that preview is off until then", () => {
    const warn = spyOnWarn();

    warnAboutContentPreviewConfig({
      contentTypes: previewable,
      secret: undefined,
    });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("openssl rand"));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Preview stays disabled"),
    );
  });

  it.each([
    ["production", "phase-production-server"],
    ["a production build", "phase-production-build"],
    ["development", ""],
  ])("never throws, including in %s", (_, phase) => {
    // `CONTENT_PREVIEW_SECRET` is optional. One content type's opt-in feature
    // must not stop the API from booting - or a build machine, which has no
    // business holding a runtime signing key, from finishing a build.
    const warn = spyOnWarn();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", phase);

    expect(() =>
      warnAboutContentPreviewConfig({
        contentTypes: previewable,
        secret: undefined,
      }),
    ).not.toThrow();
    expect(warn).toHaveBeenCalled();

    vi.unstubAllEnvs();
  });
});
