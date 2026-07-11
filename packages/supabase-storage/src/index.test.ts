import { beforeEach, describe, expect, it, vi } from "vitest";

const { StorageClient, from, getPublicUrl, remove, upload } = vi.hoisted(() => {
  const remove = vi.fn();
  const getPublicUrl = vi.fn();
  const upload = vi.fn();
  const from = vi.fn(() => ({ getPublicUrl, remove, upload }));
  const StorageClient = vi.fn(function () {
    return { from };
  });

  return { StorageClient, from, getPublicUrl, remove, upload };
});

vi.mock("@supabase/storage-js", () => ({ StorageClient }));

import { SupabaseStorageAdapter } from "./index";

const config = {
  bucket: "media",
  secretKey: "sb_secret_123",
  url: "https://project.supabase.co",
};

beforeEach(() => {
  vi.clearAllMocks();
  remove.mockResolvedValue({ error: null });
  upload.mockResolvedValue({ error: null });
  getPublicUrl.mockReturnValue({
    data: { publicUrl: "https://project.supabase.co/public/media/photo.png" },
  });
});

describe("SupabaseStorageAdapter configuration", () => {
  it.each([
    ["bucket", { ...config, bucket: "" }],
    ["secretKey", { ...config, secretKey: "" }],
    ["url", { ...config, url: "" }],
  ])("throws from getUrl when %s is missing", (_, partial) => {
    expect(() => SupabaseStorageAdapter(partial).getUrl("photo.png")).toThrow(
      "Missing Supabase Storage configuration",
    );
  });

  it("rejects from delete when configuration is incomplete", async () => {
    await expect(
      SupabaseStorageAdapter({ ...config, url: "" }).delete("photo.png"),
    ).rejects.toThrow("Missing Supabase Storage configuration");
  });

  it("rejects from upload when configuration is incomplete", async () => {
    await expect(
      SupabaseStorageAdapter({ ...config, secretKey: "" }).upload({
        body: Buffer.from("x"),
        key: "photo.png",
      }),
    ).rejects.toThrow("Missing Supabase Storage configuration");
  });

  it("never constructs a client when configuration is incomplete", () => {
    expect(() =>
      SupabaseStorageAdapter({ ...config, bucket: "" }).getUrl("photo.png"),
    ).toThrow();
    expect(StorageClient).not.toHaveBeenCalled();
  });
});

describe("SupabaseStorageAdapter client", () => {
  it("builds the storage endpoint and auth headers from config", () => {
    SupabaseStorageAdapter(config).getUrl("photo.png");

    expect(StorageClient).toHaveBeenCalledWith(
      "https://project.supabase.co/storage/v1",
      {
        apikey: "sb_secret_123",
        Authorization: "Bearer sb_secret_123",
      },
    );
  });

  it("strips a trailing slash from the url", () => {
    SupabaseStorageAdapter({
      ...config,
      url: "https://project.supabase.co/",
    }).getUrl("photo.png");

    expect(StorageClient).toHaveBeenCalledWith(
      "https://project.supabase.co/storage/v1",
      expect.anything(),
    );
  });

  it("constructs the client lazily and reuses it across calls", () => {
    const adapter = SupabaseStorageAdapter(config);
    expect(StorageClient).not.toHaveBeenCalled();

    adapter.getUrl("a.png");
    adapter.getUrl("b.png");

    expect(StorageClient).toHaveBeenCalledTimes(1);
  });

  it("isolates the client between adapter instances", () => {
    SupabaseStorageAdapter(config).getUrl("a.png");
    SupabaseStorageAdapter(config).getUrl("b.png");

    expect(StorageClient).toHaveBeenCalledTimes(2);
  });
});

describe("SupabaseStorageAdapter.getUrl", () => {
  it("returns the public url for the key from the configured bucket", () => {
    const url = SupabaseStorageAdapter(config).getUrl("photo.png");

    expect(from).toHaveBeenCalledWith("media");
    expect(getPublicUrl).toHaveBeenCalledWith("photo.png");
    expect(url).toBe("https://project.supabase.co/public/media/photo.png");
  });
});

describe("SupabaseStorageAdapter.delete", () => {
  it("removes the key from the configured bucket", async () => {
    await SupabaseStorageAdapter(config).delete("photo.png");

    expect(from).toHaveBeenCalledWith("media");
    expect(remove).toHaveBeenCalledWith(["photo.png"]);
  });

  it("throws the error returned by the storage client", async () => {
    const error = new Error("remove failed");
    remove.mockResolvedValue({ error });

    await expect(
      SupabaseStorageAdapter(config).delete("photo.png"),
    ).rejects.toBe(error);
  });
});

describe("SupabaseStorageAdapter.upload", () => {
  it("uploads with upsert and returns the key and public url", async () => {
    const body = Buffer.from("file-contents");

    const result = await SupabaseStorageAdapter(config).upload({
      body,
      contentType: "image/png",
      key: "photo.png",
    });

    expect(from).toHaveBeenCalledWith("media");
    expect(upload).toHaveBeenCalledWith("photo.png", body, {
      contentType: "image/png",
      upsert: true,
    });
    expect(result).toEqual({
      key: "photo.png",
      url: "https://project.supabase.co/public/media/photo.png",
    });
  });

  it("passes an undefined contentType through untouched", async () => {
    await SupabaseStorageAdapter(config).upload({
      body: Buffer.from("x"),
      key: "photo.png",
    });

    expect(upload).toHaveBeenCalledWith("photo.png", expect.any(Buffer), {
      contentType: undefined,
      upsert: true,
    });
  });

  it("throws the error returned by the storage client", async () => {
    const error = new Error("upload failed");
    upload.mockResolvedValue({ error });

    await expect(
      SupabaseStorageAdapter(config).upload({
        body: Buffer.from("x"),
        key: "photo.png",
      }),
    ).rejects.toBe(error);
  });

  it("does not build a public url when the upload fails", async () => {
    upload.mockResolvedValue({ error: new Error("upload failed") });

    await expect(
      SupabaseStorageAdapter(config).upload({
        body: Buffer.from("x"),
        key: "photo.png",
      }),
    ).rejects.toThrow();
    expect(getPublicUrl).not.toHaveBeenCalled();
  });
});
