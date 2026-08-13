// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  testEditorialNoteContentType,
  testEditorialPostContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import {
  contentPreviewConfigProblems,
  warnAboutContentPreviewConfig,
} from "./preview-config";

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
  vi.unstubAllEnvs();
});

describe("contentPreviewConfigProblems", () => {
  it("is empty for parseable origins", () => {
    // The signing key is not part of this: the install generates one, so there
    // is no configuration to get wrong.
    expect(contentPreviewConfigProblems()).toEqual([]);
  });

  it("says nothing about a missing CONTENT_PREVIEW_SECRET", () => {
    vi.stubEnv("CONTENT_PREVIEW_SECRET", "");

    expect(contentPreviewConfigProblems()).toEqual([]);
  });

  it("reports an unparseable web origin", () => {
    // A preview link resolved against this would not be a link.
    vi.stubEnv("NEXT_PUBLIC_WEB_URL", "not a url");

    expect(contentPreviewConfigProblems()).toEqual([
      expect.stringContaining("NEXT_PUBLIC_WEB_URL"),
    ]);
  });

  it("reports an unparseable API origin", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");

    expect(contentPreviewConfigProblems()).toEqual([
      expect.stringContaining("NEXT_PUBLIC_API_URL"),
    ]);
  });
});

describe("warnAboutContentPreviewConfig", () => {
  const spyOnWarn = () =>
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

  it("says nothing when no content type can be previewed", () => {
    // Nothing links to anything, so there is nothing to nag an install about.
    const warn = spyOnWarn();
    vi.stubEnv("NEXT_PUBLIC_WEB_URL", "not a url");

    warnAboutContentPreviewConfig({ contentTypes: withoutPreview });

    expect(warn).not.toHaveBeenCalled();
  });

  it("says nothing when the origins are parseable and no secret is set", () => {
    // The case that used to warn, and the one this whole change is about: an
    // install that configured nothing is a working install.
    const warn = spyOnWarn();
    vi.stubEnv("CONTENT_PREVIEW_SECRET", "");

    warnAboutContentPreviewConfig({ contentTypes: previewable });

    expect(warn).not.toHaveBeenCalled();
  });

  it("warns when a link cannot be built", () => {
    const warn = spyOnWarn();
    vi.stubEnv("NEXT_PUBLIC_WEB_URL", "not a url");

    warnAboutContentPreviewConfig({ contentTypes: previewable });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("NEXT_PUBLIC_WEB_URL"),
    );
  });

  it("names the content types that wanted it", () => {
    const warn = spyOnWarn();
    vi.stubEnv("NEXT_PUBLIC_WEB_URL", "not a url");

    warnAboutContentPreviewConfig({ contentTypes: previewable });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("test.editorial"),
    );
  });

  it.each([
    ["production", "phase-production-server"],
    ["a production build", "phase-production-build"],
    ["development", ""],
  ])("never throws, including in %s", (_, phase) => {
    // One content type's opt-in feature must not stop the API from booting - or
    // a build machine from finishing a build.
    const warn = spyOnWarn();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", phase);
    vi.stubEnv("NEXT_PUBLIC_WEB_URL", "not a url");

    expect(() =>
      warnAboutContentPreviewConfig({ contentTypes: previewable }),
    ).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });
});
