import { describe, expect, it } from "vitest";

import type { AutoTranslateTextClass } from "@/content/auto-translate/text";

import { autoTranslateSource } from "@/content/auto-translate/segments";

import type { LanguageDetection } from "./detect";
import type { AutoTranslateFieldSource } from "./targets";

import { decideAutoTranslateField } from "./service";

const NOW = new Date("2026-11-01T12:00:00.000Z");
const LATER = new Date(NOW.getTime() + 60_000);
const EARLIER = new Date(NOW.getTime() - 60_000);
const FINGERPRINT = "a".repeat(64);

const TRANSLATABLE: AutoTranslateTextClass = { kind: "translatable", words: 4 };
const POLISH: LanguageDetection = { confident: true, locale: "pl" };
const UNSURE: LanguageDetection = { confident: false, locale: "pl" };

const GREETING = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Dzień dobry wszystkim" }],
    },
  ],
};

const fieldOf = ({
  detection = POLISH,
  textClass = TRANSLATABLE,
}: {
  detection?: LanguageDetection;
  textClass?: AutoTranslateTextClass;
} = {}): AutoTranslateFieldSource => ({
  detection,
  fingerprint: FINGERPRINT,
  name: "body",
  source: autoTranslateSource(GREETING),
  textClass,
  value: GREETING,
});

type Input = Parameters<typeof decideAutoTranslateField>[0];
type Job = NonNullable<Input["job"]>;

const job = (status: Job["status"], extra: Partial<Job> = {}): Job => ({
  availableAt: EARLIER,
  mode: "automatic",
  reason: null,
  status,
  ...extra,
});

const decide = (input: Partial<Input> = {}) =>
  decideAutoTranslateField({
    field: fieldOf(),
    locale: "en",
    mode: "automatic",
    now: NOW,
    settings: { enabled: true, locales: ["en", "pl"] },
    ...input,
  });

describe("decideAutoTranslateField", () => {
  it.each<[string, Partial<Input>, Record<string, unknown>]>([
    // Site and request
    [
      "a client on an older version",
      { expectedFingerprint: "b".repeat(64) },
      { state: "stale" },
    ],
    [
      "a site with translation off",
      { settings: { enabled: false, locales: ["en", "pl"] } },
      { reason: "disabled", state: "unavailable" },
    ],
    [
      "a target language outside the allowlist",
      { locale: "de" },
      { reason: "locale", state: "skipped" },
    ],
    [
      "a regional target of an allowed language",
      { locale: "en-GB" },
      { queue: true, state: "missing" },
    ],
    // Saved translations win over every later rule
    [
      "a saved translation",
      {
        field: fieldOf({
          textClass: { kind: "soft_skip", reason: "single_word", words: 1 },
        }),
        job: job("failed", { availableAt: LATER }),
        stored: { sourceLocale: "pl", value: "Good morning everyone" },
      },
      { sourceLocale: "pl", state: "ready", value: "Good morning everyone" },
    ],
    // Text rules
    [
      "an acknowledgment, even by hand",
      {
        field: fieldOf({
          textClass: { kind: "hard_skip", reason: "acknowledgment" },
        }),
        mode: "manual",
      },
      { reason: "acknowledgment", state: "skipped" },
    ],
    [
      "text already in the reader's language",
      { locale: "pl" },
      { sourceLocale: "pl", state: "original" },
    ],
    [
      "a confident source language the site does not support",
      { field: fieldOf({ detection: { confident: true, locale: "de" } }) },
      {
        reason: "unsupported_language",
        sourceLocale: "de",
        state: "skipped",
      },
    ],
    [
      "a single word, automatically",
      {
        field: fieldOf({
          textClass: { kind: "soft_skip", reason: "single_word", words: 1 },
        }),
      },
      { reason: "single_word", state: "skipped" },
    ],
    [
      "a single word, by hand",
      {
        field: fieldOf({
          textClass: { kind: "soft_skip", reason: "single_word", words: 1 },
        }),
        mode: "manual",
      },
      { queue: true, state: "missing" },
    ],
    [
      "an uncertain language, automatically",
      { field: fieldOf({ detection: UNSURE }) },
      { reason: "uncertain_language", state: "skipped" },
    ],
    [
      "an uncertain language, by hand",
      { field: fieldOf({ detection: UNSURE }), mode: "manual" },
      { queue: true, state: "missing" },
    ],
    ["a lookup, which never queues", { mode: "lookup" }, { state: "missing" }],
    // Jobs for this exact source version
    ["a pending job", { job: job("pending") }, { state: "pending" }],
    ["a running job", { job: job("running") }, { state: "pending" }],
    [
      "a job waiting for the budget",
      { job: job("waiting_budget") },
      { reason: "budget", state: "unavailable" },
    ],
    [
      "a failed job in its backoff",
      { job: job("failed", { availableAt: LATER }) },
      { reason: "failed", state: "unavailable" },
    ],
    [
      "a failed job past its backoff",
      { job: job("failed") },
      { queue: true, state: "missing" },
    ],
    [
      "a completed job whose translation is gone",
      { job: job("completed") },
      { queue: true, state: "missing" },
    ],
    [
      "a job skipped for a lasting reason",
      { job: job("skipped", { reason: "too_long" }) },
      { reason: "too_long", state: "skipped" },
    ],
    [
      "a job skipped for an unknown reason",
      { job: job("skipped", { reason: "AI_SOMETHING_NEW" }) },
      { reason: "failed", state: "unavailable" },
    ],
    [
      "a job skipped because the record had changed",
      { job: job("skipped", { reason: "stale" }) },
      { queue: true, state: "missing" },
    ],
    [
      "a job skipped because the record was unreadable",
      { job: job("skipped", { reason: "not_found" }) },
      { queue: true, state: "missing" },
    ],
    [
      "an automatic skip the reader now asks for by hand",
      {
        job: job("skipped", { reason: "uncertain_language" }),
        mode: "manual",
      },
      { queue: true, state: "missing" },
    ],
    [
      "a manual skip asked for by hand again",
      {
        job: job("skipped", { mode: "manual", reason: "too_long" }),
        mode: "manual",
      },
      { reason: "too_long", state: "skipped" },
    ],
  ])("answers %s", (_case, input, expected) => {
    expect(decide(input)).toEqual({
      fingerprint: FINGERPRINT,
      name: "body",
      ...expected,
    });
  });
});
