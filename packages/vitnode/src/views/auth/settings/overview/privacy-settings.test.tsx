import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BrowseAnonymouslyPolicy } from "@/lib/user-presence";

import { PrivacySettings } from "./privacy-settings";

const REASON = "core.auth.settings.overview.browseAnonymously";

const renderSettings = (
  policy: BrowseAnonymouslyPolicy,
  hideOnlineStatus: boolean,
) => {
  const onUpdate = vi.fn(async () => Promise.resolve({ data: true as const }));
  render(
    <PrivacySettings
      hideOnlineStatus={hideOnlineStatus}
      onUpdate={onUpdate}
      policy={policy}
    />,
  );

  return { onUpdate, toggle: screen.getByRole("switch") };
};

describe("PrivacySettings", () => {
  it.each([
    ["forced", false, "true", `${REASON}Forced`],
    ["disallowed", true, "false", `${REASON}Disallowed`],
  ] as const)(
    "locks the switch when the roles' policy is %s and says why",
    (policy, hideOnlineStatus, checked, reason) => {
      const { onUpdate, toggle } = renderSettings(policy, hideOnlineStatus);

      expect(toggle.getAttribute("aria-checked")).toBe(checked);
      expect(toggle.getAttribute("aria-disabled")).toBe("true");
      expect(screen.getByText(reason)).toBeTruthy();

      fireEvent.click(toggle);

      expect(onUpdate).not.toHaveBeenCalled();
    },
  );

  it("lets the member choose when their roles allow it", async () => {
    const { onUpdate, toggle } = renderSettings("allowed", false);

    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(toggle.getAttribute("aria-disabled")).toBeNull();
    expect(screen.queryByText(`${REASON}Forced`)).toBeNull();
    expect(screen.queryByText(`${REASON}Disallowed`)).toBeNull();

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({ hideOnlineStatus: true });
    });
  });
});
