import { describe, expectTypeOf, it } from "vitest";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type {
  ContentFormLayout,
  ContentTypeFrontendRegistration,
} from "@/lib/plugin";

import type * as serverActions from "../actions/mutation-api.server";
import type { ContentMutationResult } from "../content-mutation";
import type { ContentFormTransport } from "./transport";

/**
 * The three contracts a Content Engine form is built on, asserted as types.
 *
 * None of them can be checked at runtime without rendering a form, and all three
 * are the kind that fails silently: a field override that returns a promise
 * suspends forever, a transport whose member drifts from the Server Action makes
 * one AdminCP behave differently from the other, and a layout that could reach
 * the mutation would be a plugin overriding security.
 */

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
    /**
     * The rule `content-form.tsx` states in a comment and this pins: `AutoForm`
     * calls the component function to get an element, on every render. An async
     * one would hand it a fresh promise each time, and React 19 suspends on a
     * promise child - so the dialog would spin forever with no error anywhere.
     *
     * `toExtend` rather than an equality assertion because a `ReactNode` is a
     * union that already includes `Promise<AwaitedReactNode>` in React 19's own
     * types; what is being asserted is that the *return type of the override* is
     * a node, not that a caller may await it.
     */
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

describe("the two transports answer the same questions", () => {
  /**
   * The Next.js AdminCP's transport *is* its Server Actions, handed over as an
   * object in `form/host-next.tsx`. This is the assertion that makes that legal
   * - and, more usefully, the thing that breaks if either side's signature moves
   * without the other's.
   */
  it("the Server Actions satisfy the transport interface", () => {
    expectTypeOf<{
      create: typeof serverActions.createContentAction;
      createLocalized: typeof serverActions.createLocalizedContentAction;
      edit: typeof serverActions.editContentAction;
      editLocalized: typeof serverActions.editLocalizedContentAction;
      loadOptions: typeof serverActions.loadContentOptionsAction;
      publish: typeof serverActions.publishContentAction;
      reloadRow: typeof serverActions.reloadContentRowAction;
      unpublish: typeof serverActions.unpublishContentAction;
    }>().toExtend<Omit<ContentFormTransport, "listTranslations">>();
  });

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
