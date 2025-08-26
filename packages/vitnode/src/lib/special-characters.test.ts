import { describe, expect, it } from "vitest";

import {
  checkSpecialCharacters,
  removeSpecialCharacters,
} from "./special-characters";

describe("removeSpecialCharacters", () => {
  it("should remove diacritics and replace spaces with hyphens", () => {
    expect(removeSpecialCharacters("héllo wörld")).toBe("hello-world");
  });

  it("should keep spaces when replaceSpace is false", () => {
    expect(removeSpecialCharacters("hello world", false)).toBe("hello world");
  });

  it("should remove special characters", () => {
    expect(removeSpecialCharacters("hello#world%123")).toBe("helloworld123");
  });

  it("should replace @ with -at-", () => {
    expect(removeSpecialCharacters("user@example.com")).toBe(
      "user-at-example-com",
    );
  });

  it("should replace dots with hyphens", () => {
    expect(removeSpecialCharacters("file.name.txt")).toBe("file-name-txt");
  });

  it("should replace Polish ł with l", () => {
    expect(removeSpecialCharacters("Łódź")).toBe("lodz");
  });

  it("should trim whitespace from start and end", () => {
    expect(removeSpecialCharacters("  hello world  ")).toBe("hello-world");
  });

  it("should handle empty string", () => {
    expect(removeSpecialCharacters("")).toBe("");
  });

  it("should handle multiple special characters and spaces", () => {
    expect(removeSpecialCharacters("Hello & World #123 {test}")).toBe(
      "Hello-World-123-test",
    );
  });
});

describe("checkSpecialCharacters", () => {
  it("should return true for alphanumeric characters and hyphens", () => {
    expect(checkSpecialCharacters("hello-world-123")).toBe(true);
  });

  it("should return false for special characters", () => {
    expect(checkSpecialCharacters("hello@world")).toBe(false);
  });

  it("should return false for spaces", () => {
    expect(checkSpecialCharacters("hello world")).toBe(false);
  });

  it("should return true for uppercase letters", () => {
    expect(checkSpecialCharacters("HelloWorld")).toBe(true);
  });

  it("should return true for numbers only", () => {
    expect(checkSpecialCharacters("123")).toBe(true);
  });

  it("should return true for hyphens only", () => {
    expect(checkSpecialCharacters("-")).toBe(true);
  });

  it("should return false for other special characters", () => {
    expect(checkSpecialCharacters("hello#world")).toBe(false);
    expect(checkSpecialCharacters("test.com")).toBe(false);
    expect(checkSpecialCharacters("user&name")).toBe(false);
  });
});
