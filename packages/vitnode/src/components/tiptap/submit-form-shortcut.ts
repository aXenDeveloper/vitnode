import { Extension } from "@tiptap/react";

export const SubmitFormShortcut = Extension.create({
  name: "submitFormShortcut",
  addKeyboardShortcuts() {
    return {
      "Mod-Enter": () => {
        const form = this.editor.view.dom.closest("form");
        if (!form) return false;
        form.requestSubmit();

        return true;
      },
    };
  },
});
