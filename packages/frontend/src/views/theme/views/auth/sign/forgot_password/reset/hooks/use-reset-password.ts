import { z } from 'zod';

export const useResetPassword = () => {
  const formSchema = z.object({
    pin: z.string().min(6).max(6).default(''),
    password: z
      .string()
      .regex(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+{};:,<.>]).{8,}$/)
      .default(''),
  });

  return { formSchema };
};
