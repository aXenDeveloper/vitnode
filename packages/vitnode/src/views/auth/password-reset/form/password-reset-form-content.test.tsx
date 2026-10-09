// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { rememberEmail } from "../../remembered-email";
import { PasswordResetFormContent } from "./password-reset-form-content";

const renderForm = () =>
  render(
    <PasswordResetFormContent captcha={undefined} onRequestReset={vi.fn()} />,
  );

describe("the reset-request form", () => {
  afterEach(() => {
    rememberEmail("");
  });

  it("starts empty when the visitor typed no email on the sign-in form", () => {
    renderForm();

    expect(
      screen.getByLabelText<HTMLInputElement>("core.auth.sign_up.email.label")
        .value,
    ).toBe("");
  });

  it("is filled with the email the visitor typed on the sign-in form", () => {
    rememberEmail(" test@test.com ");

    renderForm();

    expect(
      screen.getByLabelText<HTMLInputElement>("core.auth.sign_up.email.label")
        .value,
    ).toBe("test@test.com");
  });
});
