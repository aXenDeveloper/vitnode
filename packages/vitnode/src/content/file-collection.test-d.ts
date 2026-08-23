import { describe, expectTypeOf, it } from "vitest";

import type { testFileGalleryContentType } from "@/tests/content-fixtures";

import type { ContentFileDescriptor } from "./files";
import type {
  ContentChangedPath,
  ContentCreateInput,
  ContentPublicSelect,
  ContentRelationCollectionName,
  ContentSelect,
  ContentUpdateInput,
} from "./types";

/**
 * The type-level half of `field.file({ multiple: true })`.
 *
 * These are the assertions that would break silently: a gallery resolving to
 * `number` instead of `number[]` still compiles at every call site that happens
 * to pass one, and a public gallery typed as identifiers is a client rendering
 * `<img src={42}>` at runtime rather than a compile error.
 */

type Gallery = typeof testFileGalleryContentType;

describe("field.file({ multiple: true }) types", () => {
  it("is a list of identifiers on the way in", () => {
    // Optional on create, because the empty list is its default - a create that
    // says nothing about the gallery means "no files" rather than an error.
    expectTypeOf<ContentCreateInput<Gallery>["gallery"]>().toEqualTypeOf<
      number[] | undefined
    >();
    expectTypeOf<ContentUpdateInput<Gallery>["gallery"]>().toEqualTypeOf<
      number[] | undefined
    >();
  });

  it("keeps a single file field a nullable identifier", () => {
    // The two arities have to stay distinguishable at the type level, or every
    // form that reads one would compile against the other.
    expectTypeOf<ContentCreateInput<Gallery>["cover"]>().toEqualTypeOf<
      null | number | undefined
    >();
  });

  it("is absent from ContentSelect, like every other collection", () => {
    // A list that carried it would issue a query per row, so the row type does
    // not offer it and `service.advanced(id)` is the way in.
    expectTypeOf<ContentSelect<Gallery>>().not.toHaveProperty("gallery");
    expectTypeOf<ContentSelect<Gallery>>().toHaveProperty("cover");
  });

  it("crosses the public boundary as descriptors, once per entry", () => {
    expectTypeOf<ContentPublicSelect<Gallery>["gallery"]>().toEqualTypeOf<
      ContentFileDescriptor[]
    >();
    // Never nullable: the empty list is what "no files" is.
    expectTypeOf<
      ContentPublicSelect<Gallery>["cover"]
    >().toEqualTypeOf<ContentFileDescriptor | null>();
  });

  it("is on the collection API, keyed by its own name", () => {
    expectTypeOf<ContentRelationCollectionName<Gallery>>().toEqualTypeOf<
      "attachments" | "gallery"
    >();
  });

  it("appears whole in changedFields, never per entry", () => {
    expectTypeOf<"gallery">().toExtend<ContentChangedPath<Gallery>>();
  });
});
