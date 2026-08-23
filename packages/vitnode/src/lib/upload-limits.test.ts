import { describe, expect, it } from "vitest";

import type { RoleUploadSettings, UploadLimits } from "./upload-limits";

import {
  isMimeTypeAllowed,
  KILOBYTE,
  mergeRoleUploadLimits,
  NO_UPLOADS,
  remainingUploadBytes,
  UNLIMITED_UPLOADS,
  validateUploadSelection,
} from "./upload-limits";

const role = (
  settings: Partial<RoleUploadSettings> = {},
): RoleUploadSettings => ({
  allowUploadFiles: true,
  maxStorageForSubmit: null,
  totalMaxStorage: null,
  ...settings,
});

const file = (size: number, type = "image/png", name = "file.png") => ({
  name,
  size,
  type,
});

describe("mergeRoleUploadLimits", () => {
  it("refuses uploads when no role allows them", () => {
    expect(
      mergeRoleUploadLimits([
        role({ allowUploadFiles: false, maxStorageForSubmit: 100 }),
        role({ allowUploadFiles: false, totalMaxStorage: 100 }),
      ]),
    ).toEqual(NO_UPLOADS);
    expect(mergeRoleUploadLimits([])).toEqual(NO_UPLOADS);
  });

  it("converts kB limits to bytes", () => {
    expect(
      mergeRoleUploadLimits([
        role({ maxStorageForSubmit: 512, totalMaxStorage: 2048 }),
      ]),
    ).toEqual({
      allowUpload: true,
      maxBytesPerSubmit: 512 * KILOBYTE,
      maxTotalBytes: 2048 * KILOBYTE,
    });
  });

  it("takes the highest cap across roles", () => {
    expect(
      mergeRoleUploadLimits([
        role({ maxStorageForSubmit: 100, totalMaxStorage: 900 }),
        role({ maxStorageForSubmit: 300, totalMaxStorage: 200 }),
      ]),
    ).toEqual({
      allowUpload: true,
      maxBytesPerSubmit: 300 * KILOBYTE,
      maxTotalBytes: 900 * KILOBYTE,
    });
  });

  it("lets an unlimited role win over a capped one", () => {
    expect(
      mergeRoleUploadLimits([
        role({ maxStorageForSubmit: 100, totalMaxStorage: 100 }),
        role({ maxStorageForSubmit: null, totalMaxStorage: 100 }),
      ]),
    ).toEqual({
      allowUpload: true,
      maxBytesPerSubmit: null,
      maxTotalBytes: 100 * KILOBYTE,
    });
  });

  it("ignores the caps of roles that forbid uploading", () => {
    expect(
      mergeRoleUploadLimits([
        role({ maxStorageForSubmit: 100, totalMaxStorage: 100 }),
        role({
          allowUploadFiles: false,
          maxStorageForSubmit: null,
          totalMaxStorage: null,
        }),
      ]),
    ).toEqual({
      allowUpload: true,
      maxBytesPerSubmit: 100 * KILOBYTE,
      maxTotalBytes: 100 * KILOBYTE,
    });
  });
});

describe("remainingUploadBytes", () => {
  it("is null when the quota is unlimited", () => {
    expect(
      remainingUploadBytes({ limits: UNLIMITED_UPLOADS, usedBytes: 999 }),
    ).toBeNull();
  });

  it("never drops below zero", () => {
    const limits: UploadLimits = {
      allowUpload: true,
      maxBytesPerSubmit: null,
      maxTotalBytes: 100,
    };

    expect(remainingUploadBytes({ limits, usedBytes: 40 })).toBe(60);
    expect(remainingUploadBytes({ limits, usedBytes: 400 })).toBe(0);
  });
});

describe("isMimeTypeAllowed", () => {
  it("allows anything without an allowlist", () => {
    expect(isMimeTypeAllowed("application/zip")).toBe(true);
    expect(isMimeTypeAllowed("application/zip", [])).toBe(true);
    expect(isMimeTypeAllowed("application/zip", ["*"])).toBe(true);
  });

  it("matches exact types case-insensitively", () => {
    expect(isMimeTypeAllowed("IMAGE/PNG", ["image/png"])).toBe(true);
    expect(isMimeTypeAllowed("image/gif", ["image/png"])).toBe(false);
  });

  it("matches a subtype wildcard", () => {
    expect(isMimeTypeAllowed("image/gif", ["image/*"])).toBe(true);
    expect(isMimeTypeAllowed("video/mp4", ["image/*"])).toBe(false);
  });

  it("rejects a missing mime type when an allowlist exists", () => {
    expect(isMimeTypeAllowed("", ["image/png"])).toBe(false);
  });
});

describe("validateUploadSelection", () => {
  const limits: UploadLimits = {
    allowUpload: true,
    maxBytesPerSubmit: 1000,
    maxTotalBytes: 5000,
  };

  it("accepts a selection that fits", () => {
    expect(
      validateUploadSelection({
        files: [file(400), file(500)],
        limits,
        usedBytes: 1000,
      }),
    ).toBeNull();
  });

  it("rejects everything when uploads are off", () => {
    expect(
      validateUploadSelection({
        files: [file(1)],
        limits: NO_UPLOADS,
        usedBytes: 0,
      }),
    ).toEqual({ kind: "not_allowed" });
  });

  it("rejects an empty selection", () => {
    expect(
      validateUploadSelection({ files: [], limits, usedBytes: 0 }),
    ).toEqual({ kind: "empty" });
  });

  it("rejects too many files", () => {
    expect(
      validateUploadSelection({
        files: [file(1), file(1), file(1)],
        limits,
        maxFiles: 2,
        usedBytes: 0,
      }),
    ).toEqual({ kind: "too_many", limit: 2 });
  });

  it("names the file with the unsupported type", () => {
    expect(
      validateUploadSelection({
        allowedMimeTypes: ["image/*"],
        files: [file(1), file(1, "application/zip", "archive.zip")],
        limits,
        usedBytes: 0,
      }),
    ).toEqual({ kind: "mime", fileName: "archive.zip" });
  });

  it("rejects a batch over the per-submit limit", () => {
    expect(
      validateUploadSelection({
        files: [file(600), file(600)],
        limits,
        usedBytes: 0,
      }),
    ).toEqual({ kind: "submit_limit", limitBytes: 1000, totalBytes: 1200 });
  });

  it("rejects a batch that would exceed the quota", () => {
    expect(
      validateUploadSelection({
        files: [file(600)],
        limits,
        usedBytes: 4600,
      }),
    ).toEqual({ kind: "quota", limitBytes: 5000, remainingBytes: 400 });
  });

  it("counts the batch as a whole against both limits", () => {
    // Each file fits on its own; together they do not.
    expect(
      validateUploadSelection({
        files: [file(300), file(300), file(300)],
        limits: { ...limits, maxBytesPerSubmit: null, maxTotalBytes: 800 },
        usedBytes: 0,
      }),
    ).toEqual({ kind: "quota", limitBytes: 800, remainingBytes: 800 });
  });
});
