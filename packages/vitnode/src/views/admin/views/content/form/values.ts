import { useSelector } from "@tanstack/react-form";
import React from "react";

import { useFormApi } from "@/components/ui/form";

/** The form's current values, re-rendering on every change. */
export const useContentFormValues = (): Record<string, unknown> => {
  const { form } = useFormApi();

  return useSelector(
    form.store,
    state => state.values as Record<string, unknown>,
  );
};

/** Returns a stable `(name, value) => void` that sets one form field's value. */
export const useSetContentFormValue = () => {
  const { form } = useFormApi();

  return React.useCallback(
    (name: string, value: unknown) => {
      form.setFieldValue(name, value);
    },
    [form],
  );
};
