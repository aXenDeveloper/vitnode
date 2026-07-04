import type { Context } from "hono";

import { describe, expect, it, vi } from "vitest";

vi.mock("react-email", () => ({
  render: vi.fn().mockResolvedValue("RENDERED"),
}));

import { EmailModel } from "./email";

const makeCtx = (
  overrides: { email?: unknown } = {},
): {
  ctx: Context;
  dispatch: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  sendEmail: ReturnType<typeof vi.fn>;
} => {
  const dispatch = vi.fn().mockResolvedValue({ id: 1 });
  const sendEmail = vi.fn().mockResolvedValue(undefined);
  const error = vi.fn().mockResolvedValue(undefined);
  const store: Record<string, unknown> = {
    core: {
      email:
        "email" in overrides ? overrides.email : { adapter: { sendEmail } },
      plugins: [],
      metadata: { title: "Test" },
      pathToMessages: vi.fn().mockResolvedValue({ default: {} }),
    },
    queue: { dispatch },
    log: { error, warn: vi.fn(), debug: vi.fn() },
  };

  return {
    ctx: { get: (k: string) => store[k] } as unknown as Context,
    dispatch,
    sendEmail,
    error,
  };
};

describe("EmailModel.queue", () => {
  it("renders the email and enqueues a send-email task", async () => {
    const { ctx, dispatch } = makeCtx();

    await new EmailModel(ctx).send({
      to: "a@b.com",
      locale: "en",
      subject: "Hi",
      content: () => null,
    });

    expect(dispatch).toHaveBeenCalledWith({
      name: "send-email",
      payload: {
        to: "a@b.com",
        subject: "Hi",
        html: "RENDERED",
        text: "RENDERED",
      },
    });
  });

  it("resolves a function subject before enqueueing", async () => {
    const { ctx, dispatch } = makeCtx();

    await new EmailModel(ctx).send({
      to: "a@b.com",
      locale: "en",
      subject: () => "Computed",
      content: () => null,
    });

    expect(dispatch.mock.calls[0][0].payload.subject).toBe("Computed");
  });

  it("throws when no email provider is configured", async () => {
    const { ctx, dispatch } = makeCtx({ email: undefined });

    await expect(
      new EmailModel(ctx).send({
        to: "a@b.com",
        locale: "en",
        subject: "Hi",
        content: () => null,
      }),
    ).rejects.toThrow();
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("EmailModel.deliver", () => {
  it("sends a prebuilt email through the provider", async () => {
    const { ctx, sendEmail } = makeCtx();

    await new EmailModel(ctx).deliver({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>hi</p>",
      text: "hi",
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "a@b.com",
        subject: "Hi",
        html: "<p>hi</p>",
        text: "hi",
        metadata: { title: "Test" },
      }),
    );
  });
});
