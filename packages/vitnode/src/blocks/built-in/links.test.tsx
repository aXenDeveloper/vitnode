import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ctaBlock } from "./cta";
import { heroBlock } from "./hero";

const Cta = ctaBlock.component;
const Hero = heroBlock.component;

const renderCta = (href: string) =>
  render(
    <Cta
      blockId="cta"
      data={{ description: null, href, label: "Join us", title: "Hi" }}
      index={0}
      type="core:cta"
    />,
  );

const renderHero = (linkHref: string) =>
  render(
    <Hero
      blockId="hero"
      data={{
        align: "start",
        description: null,
        eyebrow: null,
        linkHref,
        linkLabel: "Read more",
        title: "Welcome",
      }}
      index={0}
      type="core:hero"
    />,
  );

const UNSAFE_HREFS = [
  "javascript:alert(document.cookie)",
  " javascript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "//evil.example",
  "http://plain.example",
];

describe("built-in block links", () => {
  it.each(["/discover", "https://vitnode.com/docs"])(
    "renders %s as a link",
    href => {
      renderCta(href);
      renderHero(href);

      expect(
        screen.getByRole("link", { name: "Join us" }).getAttribute("href"),
      ).toBe(href);
      expect(
        screen.getByRole("link", { name: "Read more" }).getAttribute("href"),
      ).toBe(href);
    },
  );

  it.each(UNSAFE_HREFS)("drops the call-to-action link for %s", href => {
    renderCta(href);

    expect(screen.getByRole("heading", { name: "Hi" })).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it.each(UNSAFE_HREFS)("drops the hero link for %s", href => {
    renderHero(href);

    expect(screen.getByRole("heading", { name: "Welcome" })).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
