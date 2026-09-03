import { describe, expectTypeOf, it } from "vitest";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type {
  ContentFormLayout,
  ContentTypeFrontendRegistration,
} from "@/lib/plugin";

import type { ContentMutationResult } from "../content-mutation";
import type { ContentFormTransport } from "./transport";

describe("a plugin's field override", () => {
  type Override = NonNullable<
    ContentTypeFrontendRegistration["fields"]
  >[string];

  it("takes exactly what AutoForm hands a field", () => {
    expectTypeOf<
      Parameters<Override["component"]>[0]
    >().toEqualTypeOf<ItemAutoFormComponentProps>();
  });

  it("is synchronous, so React never suspends on it", () => {
    expectTypeOf<ReturnType<Override["component"]>>().not.toEqualTypeOf<
      Promise<unknown>
    >();
  });
});

describe("a plugin's form layout", () => {
  it("is handed nothing it could mutate with", () => {
    // Presentation only, and this is where that is enforced. A layout gets four
    // strings and two flags: no form instance, no submit, no query client, no
    // transport, no database handle. It decides where a field appears; the
    // engine decides what happens when the form is submitted.
    expectTypeOf<Parameters<ContentFormLayout>[0]>().toEqualTypeOf<{
      contentTypeId: string;
      itemId?: number;
      mode: "create" | "edit";
      pluginId: string;
      publication: boolean;
      singular: string;
      title?: string;
    }>();
  });
});

describe("the transport contract", () => {
  it("every write answers with the one result shape", () => {
    expectTypeOf<
      Awaited<ReturnType<ContentFormTransport["edit"]>>
    >().toEqualTypeOf<ContentMutationResult>();
    expectTypeOf<
      Awaited<ReturnType<ContentFormTransport["editLocalized"]>>
    >().toEqualTypeOf<ContentMutationResult>();
    expectTypeOf<
      Awaited<ReturnType<ContentFormTransport["publish"]>>
    >().toEqualTypeOf<ContentMutationResult>();
  });

  it("an edit carries an optional version precondition", () => {
    // Optional rather than required, so the form passes it unconditionally: an
    // editorial content type requires it and every other one ignores it.
    expectTypeOf<Parameters<ContentFormTransport["edit"]>[3]>().toEqualTypeOf<
      number | undefined
    >();
  });

  it("a localized edit can omit the shared half without omitting the languages", () => {
    // `undefined` values is "nothing shared moved" - a distinct state from an
    // empty object, which would be a write of no fields.
    expectTypeOf<
      Parameters<ContentFormTransport["editLocalized"]>[2]
    >().toEqualTypeOf<Record<string, unknown> | undefined>();
  });

  it("a conflict is a structured value, never a sentence", () => {
    // `CONTENT_VERSION_CONFLICT` opens a reload dialog and everything else shows
    // a toast, so the code has to survive the transport as data.
    expectTypeOf<ContentMutationResult["conflict"]>().not.toEqualTypeOf<
      string | undefined
    >();
    expectTypeOf<
      NonNullable<ContentMutationResult["conflict"]>["code"]
    >().toExtend<string>();
  });
});
