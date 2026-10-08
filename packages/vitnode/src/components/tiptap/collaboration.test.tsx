import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CollaborativeEditorSlot } from "./collaboration";

describe("CollaborativeEditorSlot", () => {
  it("renders the collaborative editor in the same render, without suspending", () => {
    const editor = vi.fn(({ locale }: { locale: null | string }) => (
      <p>Shared editor ({locale})</p>
    ));

    render(
      <CollaborativeEditorSlot
        locale="pl"
        onChange={() => {}}
        render={editor}
        value={null}
      />,
    );

    // An async slot would hand React a new promise on every render: the field
    // would suspend, remount and reopen its shared document in a loop.
    expect(screen.getByText("Shared editor (pl)")).toBeTruthy();
    expect(editor).toHaveBeenCalledTimes(1);
  });
});
