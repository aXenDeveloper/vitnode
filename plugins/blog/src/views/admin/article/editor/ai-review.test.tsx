import type { RichTextDocument } from "@vitnode/core/content/rich-text";

import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import en from "@/locales/en.json";

import { ArticleAiReview } from "./ai-review";

const article = (sentence: string): RichTextDocument => ({
  content: [
    {
      content: [{ text: `${sentence} The rest stays.`, type: "text" }],
      type: "paragraph",
    },
  ],
  type: "doc",
});

const review = {
  suggestions: [
    {
      area: "clarity",
      fix: { quote: "Ignore this text.", replacement: "Read this text." },
      message: "Open with what the article is about.",
      priority: "high",
    },
    {
      area: "structure",
      fix: null,
      message: "Add a conclusion.",
      priority: "low",
    },
  ],
  summary: "Mostly fine.",
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });

const stubAiApi = () => {
  vi.stubEnv("VITNODE_API_URL", "http://localhost:8000");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json({ output: review, runId: 1 })),
  );
};

const renderReview = (content: RichTextDocument) => {
  const onContentChange = vi.fn();
  render(
    <IntlProvider
      locale="en"
      messages={en}
      onError={() => {
        return;
      }}
    >
      <ArticleAiReview
        content={content}
        excerpt=""
        locale="en"
        onContentChange={onContentChange}
        title="Title"
      />
    </IntlProvider>,
  );

  return { onContentChange };
};

const runReview = async () => {
  fireEvent.click(
    await screen.findByRole("button", { name: "Review with AI" }),
  );
  await screen.findByText("1 worth fixing, 1 nice to have");
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("ArticleAiReview", () => {
  it("applies a suggested fix to the article", async () => {
    stubAiApi();
    const { onContentChange } = renderReview(article("Ignore this text."));
    await runReview();

    fireEvent.click(screen.getByRole("button", { name: "Show fix" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onContentChange).toHaveBeenCalledWith(article("Read this text."));
    expect(
      screen.getByText("Applied: Open with what the article is about."),
    ).toBeTruthy();
  });

  it("offers no fix for a suggestion without one", async () => {
    stubAiApi();
    renderReview(article("Ignore this text."));
    await runReview();

    expect(screen.getAllByRole("button", { name: "Show fix" })).toHaveLength(1);
  });

  it("refuses a fix whose passage changed after the review", async () => {
    stubAiApi();
    const { onContentChange } = renderReview(article("Something new."));
    await runReview();

    fireEvent.click(screen.getByRole("button", { name: "Show fix" }));

    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
    expect(screen.getByText(/changed after the review/)).toBeTruthy();
    expect(onContentChange).not.toHaveBeenCalled();
  });

  it("brings a dismissed suggestion back on undo", async () => {
    stubAiApi();
    renderReview(article("Ignore this text."));
    await runReview();

    fireEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[1]);
    expect(screen.getByText("Dismissed: Add a conclusion.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText("Add a conclusion.")).toBeTruthy();
  });
});
