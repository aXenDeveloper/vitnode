import { z } from 'zod';

export const useResetPassword = () => {
  const formSchema = z.object({
    password: z
      .string()
      .regex(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+{};:,<.>]).{8,}$/)
      .default(''),
  });

  return { formSchema };
};
