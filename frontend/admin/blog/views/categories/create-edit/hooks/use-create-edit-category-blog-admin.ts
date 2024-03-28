import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { zodInput } from "@/functions/zod";

export const useCreateEditCategoryBlogAdmin = () => {
  const formSchema = z.object({
    name: zodInput.languageInput.min(1),
    description: zodInput.languageInput
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: [],
      description: []
    }
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    // Do something
  };

  return { form, onSubmit };
};
