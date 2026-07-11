import { beforeEach, describe, expect, it, vi } from "vitest";

const { DeleteObjectCommand, PutObjectCommand, S3Client, send } = vi.hoisted(
  () => {
    const send = vi.fn();
    const S3Client = vi.fn(function () {
      return { send };
    });
    const DeleteObjectCommand = vi.fn(function (
      input: Record<string, unknown>,
    ) {
      return { input };
    });
    const PutObjectCommand = vi.fn(function (input: Record<string, unknown>) {
      return { input };
    });

    return { DeleteObjectCommand, PutObjectCommand, S3Client, send };
  },
);

vi.mock("@aws-sdk/client-s3", () => ({
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
}));

import { S3StorageAdapter } from "./index";

const config = {
  accessKeyId: "AKIAEXAMPLE",
  bucket: "media",
  secretAccessKey: "secret",
};

beforeEach(() => {
  vi.clearAllMocks();
  send.mockResolvedValue({});
});

describe("S3StorageAdapter configuration", () => {
  it.each([
    ["bucket", { ...config, bucket: "" }],
    ["accessKeyId", { ...config, accessKeyId: "" }],
    ["secretAccessKey", { ...config, secretAccessKey: "" }],
  ])("rejects from delete when %s is missing", async (_, partial) => {
    await expect(S3StorageAdapter(partial).delete("photo.png")).rejects.toThrow(
      "Missing S3 configuration",
    );
  });

  it("rejects from upload when configuration is incomplete", async () => {
    await expect(
      S3StorageAdapter({ ...config, bucket: "" }).upload({
        body: Buffer.from("x"),
        key: "photo.png",
      }),
    ).rejects.toThrow("Missing S3 configuration");
  });

  it("never constructs a client when configuration is incomplete", async () => {
    await expect(
      S3StorageAdapter({ ...config, accessKeyId: "" }).delete("photo.png"),
    ).rejects.toThrow();
    expect(S3Client).not.toHaveBeenCalled();
  });
});

describe("S3StorageAdapter client", () => {
  it("passes region and credentials to the client", async () => {
    await S3StorageAdapter({ ...config, region: "us-east-1" }).delete(
      "photo.png",
    );

    expect(S3Client).toHaveBeenCalledWith({
      region: "us-east-1",
      endpoint: undefined,
      forcePathStyle: false,
      credentials: {
        accessKeyId: "AKIAEXAMPLE",
        secretAccessKey: "secret",
      },
    });
  });

  it("defaults the region to auto", async () => {
    await S3StorageAdapter(config).delete("photo.png");

    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({ region: "auto" }),
    );
  });

  it("enables path-style addressing when a custom endpoint is set", async () => {
    await S3StorageAdapter({
      ...config,
      endpoint: "https://account.r2.cloudflarestorage.com",
    }).delete("photo.png");

    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "https://account.r2.cloudflarestorage.com",
        forcePathStyle: true,
      }),
    );
  });

  it("honors an explicit forcePathStyle over the endpoint default", async () => {
    await S3StorageAdapter({
      ...config,
      endpoint: "https://account.r2.cloudflarestorage.com",
      forcePathStyle: false,
    }).delete("photo.png");

    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({ forcePathStyle: false }),
    );
  });

  it("constructs the client lazily and reuses it across calls", async () => {
    const adapter = S3StorageAdapter(config);
    expect(S3Client).not.toHaveBeenCalled();

    await adapter.delete("a.png");
    await adapter.delete("b.png");

    expect(S3Client).toHaveBeenCalledTimes(1);
  });
});

describe("S3StorageAdapter.getUrl", () => {
  it("uses publicUrl when set, stripping a trailing slash", () => {
    const url = S3StorageAdapter({
      ...config,
      publicUrl: "https://cdn.example.com/",
    }).getUrl("photo.png");

    expect(url).toBe("https://cdn.example.com/photo.png");
  });

  it("uses the endpoint and bucket when no publicUrl is set", () => {
    const url = S3StorageAdapter({
      ...config,
      endpoint: "https://account.r2.cloudflarestorage.com/",
    }).getUrl("photo.png");

    expect(url).toBe(
      "https://account.r2.cloudflarestorage.com/media/photo.png",
    );
  });

  it("prefers publicUrl over the endpoint", () => {
    const url = S3StorageAdapter({
      ...config,
      endpoint: "https://account.r2.cloudflarestorage.com",
      publicUrl: "https://cdn.example.com",
    }).getUrl("photo.png");

    expect(url).toBe("https://cdn.example.com/photo.png");
  });

  it("falls back to the regional AWS url", () => {
    const url = S3StorageAdapter({ ...config, region: "eu-west-1" }).getUrl(
      "photo.png",
    );

    expect(url).toBe("https://media.s3.eu-west-1.amazonaws.com/photo.png");
  });

  it("does not construct a client", () => {
    S3StorageAdapter(config).getUrl("photo.png");

    expect(S3Client).not.toHaveBeenCalled();
  });
});

describe("S3StorageAdapter.delete", () => {
  it("sends a DeleteObjectCommand for the key", async () => {
    await S3StorageAdapter(config).delete("photo.png");

    expect(DeleteObjectCommand).toHaveBeenCalledWith({
      Bucket: "media",
      Key: "photo.png",
    });
    expect(PutObjectCommand).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("propagates errors from the client", async () => {
    const error = new Error("access denied");
    send.mockRejectedValue(error);

    await expect(S3StorageAdapter(config).delete("photo.png")).rejects.toBe(
      error,
    );
  });
});

describe("S3StorageAdapter.upload", () => {
  it("sends a PutObjectCommand and returns the key and url", async () => {
    const body = Buffer.from("file-contents");

    const result = await S3StorageAdapter(config).upload({
      body,
      contentType: "image/png",
      key: "photo.png",
    });

    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: "media",
      Key: "photo.png",
      Body: body,
      ContentType: "image/png",
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      key: "photo.png",
      url: "https://media.s3.auto.amazonaws.com/photo.png",
    });
  });

  it("returns a publicUrl-based url when configured", async () => {
    const result = await S3StorageAdapter({
      ...config,
      publicUrl: "https://cdn.example.com",
    }).upload({ body: Buffer.from("x"), key: "photo.png" });

    expect(result.url).toBe("https://cdn.example.com/photo.png");
  });

  it("propagates errors from the client", async () => {
    const error = new Error("upload failed");
    send.mockRejectedValue(error);

    await expect(
      S3StorageAdapter(config).upload({
        body: Buffer.from("x"),
        key: "photo.png",
      }),
    ).rejects.toBe(error);
  });
});
