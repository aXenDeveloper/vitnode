// @vitest-environment node
import { describe, expect, it } from "vitest";

import { CONTENT_ENUM_DEFAULT_LENGTH } from "./const";
import { scalarFieldConstraintIssue } from "./field-constraints";
import { field } from "./fields";

const issue = scalarFieldConstraintIssue;

describe("constraints a scalar field could actually satisfy", () => {
  it("has nothing to say about a field that is already satisfiable", () => {
    expect(
      issue("title", field.text({ maxLength: 200, minLength: 1 })),
    ).toBeNull();
    expect(
      issue("body", field.textarea({ maxLength: 2000, minLength: 1 })),
    ).toBeNull();
    expect(
      issue("views", field.number({ defaultValue: 0, integer: true, min: 0 })),
    ).toBeNull();
    expect(
      issue(
        "tone",
        field.enum({ defaultValue: "info", values: ["info", "warning"] }),
      ),
    ).toBeNull();
  });

  it("has nothing to say about the kinds that carry no constraints", () => {
    expect(issue("done", field.boolean())).toBeNull();
    expect(issue("seenAt", field.dateTime({ defaultNow: true }))).toBeNull();
  });
});

describe("a text length window", () => {
  it("refuses a maxLength that leaves room for nothing", () => {
    expect(issue("title", field.text({ maxLength: 0 }))).toMatch(
      /must be positive/,
    );
    expect(issue("title", field.text({ maxLength: -4 }))).toMatch(
      /must be positive/,
    );
  });

  it("refuses a maxLength that does not count characters", () => {
    expect(issue("title", field.text({ maxLength: 1.5 }))).toMatch(
      /whole number/,
    );
    expect(issue("title", field.text({ maxLength: Number.NaN }))).toMatch(
      /whole number/,
    );
    expect(
      issue("title", field.text({ maxLength: Number.POSITIVE_INFINITY })),
    ).toMatch(/whole number/);
  });

  it("refuses a minLength below zero or between two whole numbers", () => {
    expect(issue("title", field.text({ minLength: -1 }))).toMatch(
      /zero or more/,
    );
    expect(issue("title", field.text({ minLength: 2.5 }))).toMatch(
      /zero or more/,
    );
    expect(issue("title", field.text({ minLength: Number.NaN }))).toMatch(
      /zero or more/,
    );
  });

  it("keeps the wording a content type already answers with", () => {
    expect(issue("title", field.text({ maxLength: 3, minLength: 10 }))).toMatch(
      /minLength 10 greater than maxLength 3/,
    );
    expect(
      issue("body", field.textarea({ maxLength: 5, minLength: 20 })),
    ).toMatch(/minLength 20 greater than maxLength 5/);
  });

  it("refuses a default that its own window would reject", () => {
    expect(
      issue("title", field.text({ defaultValue: "hi", minLength: 5 })),
    ).toMatch(/against a minLength of 5/);
    expect(
      issue(
        "title",
        field.text({ defaultValue: "far too long", maxLength: 3 }),
      ),
    ).toMatch(/against a maxLength of 3/);
    expect(
      issue(
        "body",
        field.textarea({ defaultValue: "hi", maxLength: 40, minLength: 5 }),
      ),
    ).toMatch(/against a minLength of 5/);
  });

  it("accepts a default that sits exactly on either edge", () => {
    expect(
      issue(
        "title",
        field.text({ defaultValue: "abc", maxLength: 3, minLength: 3 }),
      ),
    ).toBeNull();
  });
});

describe("a number range", () => {
  it("keeps the wording a content type already answers with", () => {
    expect(
      issue("views", field.number({ integer: true, max: 1, min: 10 })),
    ).toMatch(/min 10 greater than max 1/);
  });

  it("refuses a bound or a default nothing could be compared against", () => {
    expect(
      issue("views", field.number({ integer: true, min: Number.NaN })),
    ).toMatch(/not a finite number/);
    expect(
      issue(
        "views",
        field.number({ integer: true, max: Number.POSITIVE_INFINITY }),
      ),
    ).toMatch(/not a finite number/);
    expect(
      issue(
        "ratio",
        field.number({
          defaultValue: Number.NEGATIVE_INFINITY,
          integer: false,
        }),
      ),
    ).toMatch(/not a finite number/);
  });

  it("refuses a fractional default on a whole-number field", () => {
    expect(
      issue("views", field.number({ defaultValue: 1.5, integer: true })),
    ).toMatch(/integer: true/);
  });

  it("allows a fractional bound on a whole-number field, which rounds into range", () => {
    expect(
      issue("views", field.number({ integer: true, min: 2.4 })),
    ).toBeNull();
    expect(
      issue("views", field.number({ integer: true, max: 9.5 })),
    ).toBeNull();
  });

  it("allows a fractional bound on a field that stores fractions", () => {
    expect(
      issue("ratio", field.number({ integer: false, max: 1.5, min: 0.5 })),
    ).toBeNull();
  });

  it("refuses a default outside its own range", () => {
    expect(
      issue("views", field.number({ defaultValue: 0, integer: true, min: 1 })),
    ).toMatch(/below its own min of 1/);
    expect(
      issue("views", field.number({ defaultValue: 10, integer: true, max: 5 })),
    ).toMatch(/above its own max of 5/);
  });

  it("accepts a default that sits exactly on either edge", () => {
    expect(
      issue(
        "views",
        field.number({ defaultValue: 5, integer: true, max: 5, min: 1 }),
      ),
    ).toBeNull();
  });
});

describe("an enum's values", () => {
  it("refuses a list of nothing", () => {
    expect(
      // @ts-expect-error - an enum needs at least one value.
      issue("status", field.enum({ values: [] })),
    ).toMatch(/needs at least one value/);
  });

  it("refuses two values that could never be told apart", () => {
    expect(issue("status", field.enum({ values: ["a", "b", "a"] }))).toMatch(
      /duplicate enum values/,
    );
  });

  it("refuses a value longer than the length it is stored at", () => {
    expect(
      issue("status", field.enum({ length: 4, values: ["draft", "ok"] })),
    ).toMatch(/longer than the column length 4/);
    expect(
      issue(
        "status",
        field.enum({ values: ["a".repeat(CONTENT_ENUM_DEFAULT_LENGTH + 1)] }),
      ),
    ).toMatch(
      new RegExp(
        `longer than the column length ${CONTENT_ENUM_DEFAULT_LENGTH}`,
      ),
    );
  });

  it("refuses a default that is not one of the values", () => {
    expect(
      // @ts-expect-error - "nope" is not one of `values`.
      issue("status", field.enum({ defaultValue: "nope", values: ["draft"] })),
    ).toMatch(/not one of its values/);
  });
});
