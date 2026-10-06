import { useSelector } from "@tanstack/react-form";
import React from "react";

import { useFormApi } from "@/components/ui/form";

export const useContentFormValues = (): Record<string, unknown> => {
  const { form } = useFormApi();

  return useSelector(
    form.store,
    state => state.values as Record<string, unknown>,
  );
};

export const useSetContentFormValue = () => {
  const { form } = useFormApi();

  return React.useCallback(
    (name: string, value: unknown) => {
      form.setFieldValue(name, value);
    },
    [form],
  );
};
