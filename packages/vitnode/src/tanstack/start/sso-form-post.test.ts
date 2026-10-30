import { describe, expect, it, vi } from "vitest";

import { runSsoFormPost } from "./sso-form-post";

type Context = Parameters<typeof runSsoFormPost>[0];

const post = async (
  path: string,
  fields: Record<string, string>,
  {
    contentType = "application/x-www-form-urlencoded",
    handlerType = "router",
  }: { contentType?: string; handlerType?: string } = {},
) => {
  const next = vi.fn(async () =>
    Promise.resolve({ response: new Response("page") }),
  );
  const result = await runSsoFormPost({
    handlerType: handlerType as Context["handlerType"],
    next: next as unknown as Context["next"],
    request: new Request(`https://forum.example${path}`, {
      body: new URLSearchParams(fields),
      headers: { "content-type": contentType },
      method: "POST",
    }),
  });

  return { next, response: result instanceof Response ? result : null };
};

describe("Apple's form_post sign-in callback", () => {
  it("becomes a same-URL GET carrying the code and state", async () => {
    const { next, response } = await post("/login/sso/apple", {
      code: "c-1",
      id_token: "eyJ.secret.token",
      state: "s-1",
    });

    expect(next).not.toHaveBeenCalled();
    expect(response?.status).toBe(303);
    expect(response?.headers.get("location")).toBe(
      "/login/sso/apple?code=c-1&state=s-1",
    );
    expect(response?.headers.get("cache-control")).toBe("no-store");
    expect(response?.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("keeps only the name from Apple's `user`, never the unsigned email", async () => {
    const { response } = await post("/login/sso/apple", {
      code: "c-1",
      state: "s-1",
      user: JSON.stringify({
        email: "attacker@example.test",
        name: { firstName: "Alice", lastName: "Smith" },
      }),
    });
    const user = new URL(
      response?.headers.get("location") ?? "",
      "https://forum.example",
    ).searchParams.get("user");

    expect(JSON.parse(user ?? "null")).toEqual({
      name: { firstName: "Alice", lastName: "Smith" },
    });
  });

  it("drops a `user` that is not the JSON Apple sends", async () => {
    const { response } = await post("/login/sso/apple", {
      code: "c-1",
      state: "s-1",
      user: "<script>",
    });

    expect(response?.headers.get("location")).toBe(
      "/login/sso/apple?code=c-1&state=s-1",
    );
  });

  it("turns Apple's cancel into the access_denied every callback understands", async () => {
    const { response } = await post("/login/sso/apple", {
      error: "user_cancelled_authorize",
      state: "s-1",
    });

    expect(response?.headers.get("location")).toBe(
      "/login/sso/apple?state=s-1&error=access_denied",
    );
  });

  it.each([
    ["another page", "/login", {}],
    ["a JSON body", "/login/sso/apple", { contentType: "application/json" }],
    ["a server function", "/login/sso/apple", { handlerType: "serverFn" }],
  ])("leaves %s alone", async (_, path, options) => {
    const { next, response } = await post(path, { code: "c" }, options);

    expect(next).toHaveBeenCalledOnce();
    expect(response).toBeNull();
  });
});
